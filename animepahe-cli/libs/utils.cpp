#include <re2/re2.h>
#include <pugixml.hpp>
#include <set>
#include <sstream>
#include <iomanip>
#include <iostream>
#include <algorithm>
#include <string_view>

namespace AnimepaheCLI
{
    int getPage(int number)
    {
        return std::max(1, (number + 29) / 30);
    }

    bool isValidTxtFilename(const std::string& filename) {
        // Disallow any path separator
        if (filename.find('/') != std::string::npos || filename.find('\\') != std::string::npos) {
            return false;
        }

        // Check with RE2 regex
        // Pattern: Only letters, digits, underscores, hyphens, dots, ends with ".txt"
        static const RE2 pattern(R"(^[a-zA-Z0-9_\-\.]+\.\S*$)");

        return RE2::FullMatch(filename, pattern);
    }

    std::vector<int> getPaginationRange(int start, int end)
    {
        int start_page = getPage(start);
        int end_page = getPage(end);
        std::vector<int> pages;

        for (int i = start_page; i <= end_page; ++i)
        {
            pages.push_back(i);
        }

        return pages;
    }

    std::string sanitize_utf8(const std::string &input)
    {
        std::string output;
        output.reserve(input.size());

        const unsigned char *data = reinterpret_cast<const unsigned char *>(input.data());
        size_t len = input.size();

        for (size_t i = 0; i < len;)
        {
            unsigned char byte = data[i];

            if (byte <= 0x7F)
            {
                output += byte;
                i++;
            }
            else if ((byte >> 5) == 0x6 && i + 1 < len &&
                     (data[i + 1] & 0xC0) == 0x80)
            {
                output.append(reinterpret_cast<const char *>(&data[i]), 2);
                i += 2;
            }
            else if ((byte >> 4) == 0xE && i + 2 < len &&
                     (data[i + 1] & 0xC0) == 0x80 &&
                     (data[i + 2] & 0xC0) == 0x80)
            {
                output.append(reinterpret_cast<const char *>(&data[i]), 3);
                i += 3;
            }
            else if ((byte >> 3) == 0x1E && i + 3 < len &&
                     (data[i + 1] & 0xC0) == 0x80 &&
                     (data[i + 2] & 0xC0) == 0x80 &&
                     (data[i + 3] & 0xC0) == 0x80)
            {
                output.append(reinterpret_cast<const char *>(&data[i]), 4);
                i += 4;
            }
            else
            {
                // invalid byte, skip
                i++;
            }
        }

        return output;
    }

    bool isFullSeriesURL(const std::string &url)
    {
        return RE2::FullMatch(url, R"(^https:\/\/animepahe\.ru\/anime\/[a-f0-9\-]{36}$)");
    }

    bool isEpisodeURL(const std::string &url)
    {
        return RE2::FullMatch(url, R"(^https:\/\/animepahe\.ru\/play\/[a-f0-9\-]{36}\/[a-f0-9]{64}$)");
    }

    bool isValidEpisodeRangeFormat(const std::string &input)
    {
        if (input == "all")
            return true;

        int start, end;
        return RE2::FullMatch(input, R"((\d+)-(\d+))", &start, &end) && start > 0 && end > start;
    }

    /* parse episodes 1-15 */
    std::vector<int> parseEpisodeRange(const std::string &input)
    {
        int start, end;
        if (RE2::FullMatch(input, R"((\d+)-(\d+))", &start, &end))
        {
            if (start > 0 && end > start)
            {
                return {start, end};
            }
        }
        throw std::invalid_argument("Invalid episode range format");
    }

    std::string unescape_html_entities(const std::string &input)
    {
        pugi::xml_document doc;

        // Wrap string in dummy XML structure
        std::string xml = "<root>" + input + "</root>";
        pugi::xml_parse_result result = doc.load_string(xml.c_str());

        if (!result)
        {
            std::cerr << "Failed to parse XML: " << result.description() << "\n";
            return input; // fallback to original
        }

        return doc.child("root").text().get(); // decoded text
    }

    std::string padIntWithZero(int num)
    {
        std::ostringstream oss;
        oss << std::setw(2) << std::setfill('0') << num;
        return oss.str();
    }
}

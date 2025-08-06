#include <animepahe.hpp>
#include <kwikpahe.hpp>
#include <cpr/cpr.h>
#include <re2/re2.h>
#include <fmt/core.h>
#include <fmt/color.h>
#include <utils.hpp>
#include <nlohmann/json.hpp>
#include <fstream>

using json = nlohmann::json;

namespace AnimepaheCLI
{
    cpr::Cookies cookies = cpr::Cookies{{"__ddg2_", ""}};
    const char *CLEAR_LINE = "\033[2K"; // Clear entire line
    const char *MOVE_UP = "\033[1A";    // Move cursor up 1 line
    const char *CURSOR_START = "\r";    // Return to start of line

    /* Extract Kwik from pahe.win */
    KwikPahe kwikpahe;

    cpr::Header Animepahe::getHeaders(const std::string &link)
    {
        const cpr::Header HEADERS = {
            {"accept", "application/json, text/javascript, */*; q=0.0"},
            {"accept-language", "en-US,en;q=0.9"},
            {"referer", link},
            {"user-agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36 Edg/138.0.0.0"}};
        return HEADERS;
    }

    void Animepahe::extract_link_metadata(const std::string &link, bool isSeries)
    {
        fmt::print("\n\r * Requesting Info..");
        cpr::Response response = cpr::Get(
            cpr::Url{link},
            cpr::Header{getHeaders(link)}, cookies);

        fmt::print("\r * Requesting Info : ");

        if (response.status_code != 200)
        {
            fmt::print(fmt::fg(fmt::color::indian_red), "FAILED!\n");
            throw std::runtime_error(fmt::format("Failed to fetch {}, StatusCode: {}", link, response.status_code));
        }
        else
        {
            fmt::print(fmt::fg(fmt::color::lime_green), "OK!\n");
        }

        RE2::GlobalReplace(&response.text, R"((\r\n|\r|\n))", "");

        if (isSeries)
        {
            re2::StringPiece TITLE_CONSUME = response.text;
            re2::StringPiece TYPE_CONSUME = response.text;
            re2::StringPiece EP_CONSUME = response.text;
            std::string title;
            std::string type;
            std::string episodesCount;

            if (RE2::FindAndConsume(&TITLE_CONSUME, R"re(style=[^=]+title="([^"]+)")re", &title))
            {
                title = unescape_html_entities(title);
            }

            if (RE2::FindAndConsume(&TYPE_CONSUME, R"re(Type:[^>]*title="[^"]*"[^>]*>([^<]+)</a>)re", &type))
            {
                type = unescape_html_entities(type);
            }

            if (RE2::FindAndConsume(&TYPE_CONSUME, R"re(Episode[^>]*>\s*(\S*)</p)re", &episodesCount))
            {
                episodesCount = unescape_html_entities(episodesCount);
            }

            fmt::print("\n * Anime: {}\n", title);
            fmt::print(" * Type: {}\n", type);
            fmt::print(" * Episodes: {}\n", episodesCount);
        }
        else
        {
            re2::StringPiece TITLE_TYPE_CONSUME = response.text;
            std::string title;
            std::string episode;

            if (RE2::FindAndConsume(&TITLE_TYPE_CONSUME, R"re(title="[^>]*>([^<]*)</a>\D*(\d*)<span)re", &title, &episode))
            {
                episode = unescape_html_entities(episode);
                title = unescape_html_entities(title);
            }

            fmt::print("\n * Anime: {}\n", title);
            fmt::print(" * Episode: {}\n", episode);
        }
    }

    std::map<std::string, std::string> Animepahe::fetch_episode(const std::string &link, const int &targetRes)
    {
        std::vector<std::map<std::string, std::string>> episodeData;
        cpr::Response response = cpr::Get(
            cpr::Url{link},
            cpr::Header{getHeaders(link)}, cookies);

        if (response.status_code != 200)
        {
            fmt::print("\n * Error: Failed to fetch {}, StatusCode {}\n", link, response.status_code);
            return {};
        }

        RE2::GlobalReplace(&response.text, R"((\r\n|\r|\n))", "");
        re2::StringPiece EP_CONSUME = response.text;
        std::string dPaheLink;
        std::string epName;

        while (RE2::FindAndConsume(&EP_CONSUME, R"re(href="(https://pahe\.win/\S*)"[^>]*>([^)]*\))[^<]*<)re", &dPaheLink, &epName))
        {
            std::map<std::string, std::string> content;
            content["dPaheLink"] = unescape_html_entities(dPaheLink);
            content["epName"] = unescape_html_entities(epName);

            re2::StringPiece RES_CONSUME = epName;
            std::string epRes;
            if (RE2::FindAndConsume(&RES_CONSUME, R"re(\b(\d{3,4})p\b)re", &epRes))
            {
                epRes = unescape_html_entities(epRes);
            }
            else
            {
                epRes = "0";
            }

            content["epRes"] = epRes;
            episodeData.push_back(content);
        }

        if (episodeData.empty())
        {
            throw std::runtime_error(fmt::format("\n No episodes found in {}", link));
        }

        /**
         * check if there is a provided resolution
         * if there is a match then return it otherwise Find the episode with the highest resolution
         * Since Animepahe sort JPN episodes at top this selects the highest resolution
         * JPN Episode and igore all others. btw who wants to watch anime in ENG anyway ?
         */
        std::map<std::string, std::string>* selectedEpMap = nullptr;
        std::map<std::string, std::string>* maxEpMap = nullptr;
        std::map<std::string, std::string>* minEpMap = nullptr;

        int maxEpRes = 0;
        int minEpRes = INT_MAX; /* use INT_MAX to ensure proper min comparison */

        bool selectHighestQuality = (targetRes == 0);
        bool selectLowestQuality  = (targetRes == -1);
        bool isCustomQualityProvided = (targetRes > 0); /* only valid custom inputs are > 0 */

        for (auto& episode : episodeData)
        {
            int epResValue = std::stoi(episode.at("epRes"));

            /* Track highest */
            if (epResValue > maxEpRes)
            {
                maxEpRes = epResValue;
                maxEpMap = &episode;
            }

            /* Track lowest */
            if (epResValue < minEpRes)
            {
                minEpRes = epResValue;
                minEpMap = &episode;
            }

            /* If custom quality requested */
            if (isCustomQualityProvided && epResValue == targetRes)
            {
                selectedEpMap = &episode;
                break; /* exact match found, no need to continue */
            }
        }

        /* Final decision */
        if (selectedEpMap == nullptr)
        {
            if (selectHighestQuality) {
                selectedEpMap = maxEpMap;
            } else if (selectLowestQuality) {
                selectedEpMap = minEpMap;
            }
            /* else (custom and not found) fallback to max */
            else {
                selectedEpMap = maxEpMap;
            }
        }

        return *selectedEpMap;
    }

    std::vector<std::string> Animepahe::fetch_series(
        const std::string &link,
        const int epCount,
        bool isAllEpisodes,
        const std::vector<int> &episodes)
    {
        std::vector<std::string> links;
        std::vector<int> paginationPages;

        if (isAllEpisodes)
        {
            paginationPages = getPaginationRange(1, epCount);
        }
        else
        {
            paginationPages = getPaginationRange(episodes[0], episodes[1]);
        }

        std::string id;
        RE2::PartialMatch(link, R"(anime/([a-f0-9-]{36}))", &id);
        fmt::print("\n\r * Requesting Pages..");
        for (auto &page : paginationPages)
        {
            fmt::print("\r * Requesting Pages : {}", page);
            fflush(stdout);
            cpr::Response response = cpr::Get(
                cpr::Url{
                    fmt::format("https://animepahe.ru/api?m=release&id={}&sort=episode_asc&page={}", id, page)},
                cpr::Header{getHeaders(link)}, cookies);

            if (response.status_code != 200)
            {
                throw std::runtime_error(fmt::format("\n * Error: Failed to fetch {}, StatusCode {}\n", link, response.status_code));
            }

            auto parsed = json::parse(response.text);

            if (parsed.contains("data") && parsed["data"].is_array())
            {
                for (const auto &episode : parsed["data"])
                {
                    std::string session = episode.value("session", "unknown");
                    std::string episodeLink = fmt::format("https://animepahe.ru/play/{}/{}", id, session);
                    links.push_back(episodeLink);
                }
            }
        }
        fmt::print("\r * Requesting Pages :");
        fmt::print(fmt::fg(fmt::color::lime_green), " OK!\n\r");

        return links;
    }

    int Animepahe::get_series_episode_count(const std::string &link)
    {
        std::string id;
        RE2::PartialMatch(link, R"(anime/([a-f0-9-]{36}))", &id);

        cpr::Response response = cpr::Get(
            cpr::Url{
                fmt::format("https://animepahe.ru/api?m=release&id={}&sort=episode_asc&page={}", id, 1)},
            cpr::Header{getHeaders(link)}, cookies);

        if (response.status_code != 200)
        {
            throw std::runtime_error(fmt::format("\n * Error: Failed to fetch {}, StatusCode {}\n", link, response.status_code));
        }

        auto parsed = json::parse(response.text);
        int epCount = 0;
        if (parsed.contains("total") && parsed["total"].is_number_integer())
        {
            epCount = parsed["total"];
        }

        return epCount;
    }

    std::vector<std::map<std::string, std::string>> Animepahe::extract_link_content(
        const std::string &link,
        const std::vector<int> &episodes,
        const int targetRes,
        bool isSeries,
        bool isAllEpisodes)
    {
        std::vector<std::map<std::string, std::string>> episodeListData;

        if (isSeries)
        {
            const int epCount = get_series_episode_count(link);
            std::vector<std::string> seriesEpLinks = fetch_series(link, epCount, isAllEpisodes, episodes);

            if (isAllEpisodes)
            {
                for (int i = 0; i < seriesEpLinks.size(); ++i)
                {
                    const std::string &pLink = seriesEpLinks[i];
                    fmt::print("\r * Requesting Episode : EP{} ", padIntWithZero(i + 1));
                    std::map<std::string, std::string> epContent = fetch_episode(pLink, targetRes);
                    fflush(stdout);
                    if (!epContent.empty())
                    {
                        episodeListData.push_back(epContent);
                    }
                }
            }
            else
            {
                if (episodes[0] > epCount || episodes[1] > epCount)
                {
                    throw std::runtime_error(fmt::format("Invalid episode range: {}-{} for series with {} episodes", episodes[0], episodes[1], epCount));
                }

                std::vector<int> paginationPages = getPaginationRange(episodes[0], episodes[1]);
                int offset = paginationPages[0] == 1 ? 0 : (30 * (paginationPages[0] - 1));

                for (int i = offset; i < (seriesEpLinks.size() + offset); ++i)
                {
                    const std::string &pLink = seriesEpLinks[i - offset];

                    if ((i >= episodes[0] - 1 && i <= episodes[1] - 1))
                    {
                        fmt::print("\r * Requesting Episode : EP{} ", padIntWithZero(i + 1));
                        std::map<std::string, std::string> epContent = fetch_episode(pLink, targetRes);
                        fflush(stdout);
                        if (!epContent.empty())
                        {
                            episodeListData.push_back(epContent);
                        }
                    }
                }
            }
        }
        else
        {

            std::map<std::string, std::string> epContent = fetch_episode(link, targetRes);
            if (epContent.empty())
            {
                fmt::print("\n * Error: No episode data found for {}\n", link);
                return {};
            }

            episodeListData.push_back(epContent);
        }

        fmt::print("\r * Requesting Episodes : {} ", episodeListData.size());
        fmt::print(fmt::fg(fmt::color::lime_green), "OK!\n");
        return episodeListData;
    }

    void Animepahe::extractor(
        bool isSeries,
        const std::string &link,
        const int targetRes,
        bool isAllEpisodes,
        const std::vector<int> &episodes,
        const std::string &export_filename,
        bool exportLinks,
        bool createZip
    )
    {
        /* print config */
        fmt::print("\n * targetResolution: ");
        if (targetRes == 0)
        {
            fmt::print("Max Available\n");
        }
        else if (targetRes == -1)
        {
            fmt::print(fmt::fg(fmt::color::cyan), "Lowest Available\n");
        }
        else
        {
            fmt::print(fmt::fg(fmt::color::cyan), fmt::format("{}p\n", targetRes));
        }
        fmt::print(" * exportLinks: ");
        exportLinks ? fmt::print(fmt::fg(fmt::color::cyan), "true") : fmt::print("false");
        (exportLinks && export_filename != "links.txt") ? fmt::print(fmt::fg(fmt::color::cyan), fmt::format(" [{}]\n", export_filename)) : fmt::print("\n");
        fmt::print(" * createZip: ", createZip);
        createZip ? fmt::print(fmt::fg(fmt::color::cyan), "true\n") : fmt::print("false\n");

        /* Requested Episodes Range */
        if (isSeries)
        {
            fmt::print(" * episodesRange: ");
            isAllEpisodes ? fmt::print("All") : fmt::print(fmt::fg(fmt::color::cyan), vectorToString(episodes));
            fmt::print("\n");
        }
        /* Request Metadata */
        extract_link_metadata(link, isSeries);

        /* Extract Links */
        const std::vector<std::map<std::string, std::string>> epData = extract_link_content(link, episodes, targetRes, isSeries, isAllEpisodes);

        std::vector<std::string> directLinks;
        int logEpNum = isAllEpisodes ? 1 : episodes[0];
        for (int i = 0; i < epData.size(); ++i)
        {
            fmt::print("\n\r * Processing :");
            fmt::print(fmt::fg(fmt::color::cyan), fmt::format(" EP{}", padIntWithZero(logEpNum)));
            std::string link = kwikpahe.extract_kwik_link(epData[i].at("dPaheLink"));
            for (int i = 0; i < 3; ++i)
            {
                fmt::print("{}{}{}", MOVE_UP, CLEAR_LINE, CURSOR_START);
            }
            fmt::print("\r * Processing : EP{}", padIntWithZero(logEpNum));
            if (link.empty())
            {
                fmt::print(fmt::fg(fmt::color::indian_red), " FAIL!");
            }
            else
            {
                directLinks.push_back(link);
                fmt::print(fmt::fg(fmt::color::lime_green), " OK!");
            }
            logEpNum++;
        }

        if (exportLinks)
        {
            std::ofstream exportfile(export_filename);
            if (exportfile.is_open())
            {
                for (auto &link : directLinks)
                {
                    exportfile << link << "\n";
                }
                exportfile.close();
            }
            fmt::print("\n\n * Exported : {}\n\n", export_filename);
        }
        else
        {
            fmt::print("\n\n * createZip: {}\n", createZip);
        }
    }
}

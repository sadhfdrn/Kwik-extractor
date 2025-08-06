#include "githubupdater.hpp"
#include <cpr/cpr.h>
#include <nlohmann/json.hpp>
#include <fmt/core.h>
#include <fmt/color.h>
#include <iostream>
#include <fstream>
#include <filesystem>
#include <regex>
#include <thread>
#include <chrono>
#include <iomanip>
#include <ctime>
#include <algorithm>
#include <windows.h>
#include <shellapi.h>

GitHubUpdater::GitHubUpdater(
    const std::string& owner,
    const std::string& name,
    const std::string& version,
    const std::string& token
) : repo_owner(owner), repo_name(name), current_version(version), github_token(token) {}

bool GitHubUpdater::isNewerVersion(const std::string& latest, const std::string& current) {
    /* Remove 'v' prefix if present */
    std::string latest_clean = latest.substr(latest.find_first_of("0123456789"));
    std::string current_clean = current.substr(current.find_first_of("0123456789"));
    
    std::regex version_regex(R"((\d+)\.(\d+)\.(\d+))");
    std::smatch latest_match, current_match;
    
    if (!std::regex_search(latest_clean, latest_match, version_regex) ||
        !std::regex_search(current_clean, current_match, version_regex)) {
        return false;
    }
    
    int latest_major = std::stoi(latest_match[1]);
    int latest_minor = std::stoi(latest_match[2]);
    int latest_patch = std::stoi(latest_match[3]);
    
    int current_major = std::stoi(current_match[1]);
    int current_minor = std::stoi(current_match[2]);
    int current_patch = std::stoi(current_match[3]);
    
    if (latest_major != current_major) return latest_major > current_major;
    if (latest_minor != current_minor) return latest_minor > current_minor;
    return latest_patch > current_patch;
}

std::optional<GitHubUpdater::Release> GitHubUpdater::checkForUpdate() {
    std::string url = "https://api.github.com/repos/" + repo_owner + "/" + repo_name + "/releases/latest";
    
    cpr::Header headers;
    headers["User-Agent"] = "AnimePaheCLI/1.0";
    if (!github_token.empty()) {
        headers["Authorization"] = "token " + github_token;
    }
    
    auto response = cpr::Get(cpr::Url{url}, headers);
    
    if (response.status_code != 200) {
        std::cerr << "Failed to check for updates: " << response.status_code << std::endl;
        return std::nullopt;
    }
    
    try {
        auto json = nlohmann::json::parse(response.text);
        Release release;
        release.tag_name = json["tag_name"];
        release.name = json["name"];
        release.body = json["body"];
        release.prerelease = json["prerelease"];
        
        /* Extract assets */
        for (const auto& asset : json["assets"]) {
            release.assets.emplace_back(asset["name"], asset["browser_download_url"]);
        }
        
        if (isNewerVersion(release.tag_name, current_version)) {
            return release;
        }
    } catch (const std::exception& e) {
        std::cerr << "Error parsing release data: " << e.what() << std::endl;
    }
    
    return std::nullopt;
}

bool GitHubUpdater::downloadFile(
    const std::string& url,
    const std::string& filepath, 
    std::function<void(double)> progress_callback
) {
    std::ofstream file(filepath, std::ios::binary);
    if (!file.is_open()) {
        std::cerr << "Cannot open file for writing: " << filepath << std::endl;
        return false;
    }
    
    cpr::Header headers;
    headers["User-Agent"] = "GitHubUpdater/1.0";
    if (!github_token.empty()) {
        headers["Authorization"] = "token " + github_token;
    }
    
    auto response = cpr::Get(
        cpr::Url{url},
        headers,
        cpr::WriteCallback([&file](std::string data, intptr_t userdata) -> bool {
            file.write(data.c_str(), data.size());
            return true;
        }),
        cpr::ProgressCallback([progress_callback](
            cpr::cpr_off_t downloadTotal, cpr::cpr_off_t downloadNow,
            cpr::cpr_off_t uploadTotal, cpr::cpr_off_t uploadNow,
            intptr_t userdata
        ) -> bool {
            if (progress_callback && downloadTotal > 0) {
                double progress = static_cast<double>(downloadNow) / downloadTotal * 100.0;
                progress_callback(progress);
            }
            return true;
        })
    );
    
    file.close();
    
    if (response.status_code != 200) {
        std::cerr << "Download failed: " << response.status_code << std::endl;
        std::filesystem::remove(filepath);
        return false;
    }
    
    return true;
}

std::string GitHubUpdater::findPlatformAsset(const Release& release) {
    /* Look for platform-specific executable */
    for (const auto& asset : release.assets) {
        std::string asset_name_lower = asset.first;
        std::transform(
            asset_name_lower.begin(),
            asset_name_lower.end(), 
            asset_name_lower.begin(), ::tolower
        );
        
        if ((asset_name_lower.find(".exe") != std::string::npos)) {
            return asset.second; /* Return download URL */
        }
    }
    
    return "";
}

bool GitHubUpdater::performUpdate(const Release& release) {
    std::string download_url = findPlatformAsset(release);
    if (download_url.empty()) {
        std::cerr << "No suitable asset found for current platform" << std::endl;
        return false;
    }
    
    std::cout << "\n Downloading update " << release.tag_name << "..." << std::endl;
    
    std::string temp_file = "update_temp_" + std::to_string(std::time(nullptr));
#ifdef _WIN32
    temp_file += ".exe";
#endif
    
    /* Download with progress */
    bool download_success = downloadFile(download_url, temp_file, [](double progress) {
        std::cout << " \r Progress: " << std::fixed
        << std::setprecision(1) 
        << progress << "%" << std::flush;
    });
    
    std::cout << std::endl;
    
    if (!download_success) {
        return false;
    }
    
    /* Get current executable path */
    std::string current_exe = getCurrentExecutablePath();
    if (current_exe.empty()) {
        std::cerr << "Cannot determine current executable path" << std::endl;
        std::filesystem::remove(temp_file);
        return false;
    }
    
    /* Apply the update */
    return applyUpdate(temp_file, current_exe);
}

std::string GitHubUpdater::getCurrentExecutablePath() {
    char path[MAX_PATH];
    GetModuleFileNameA(NULL, path, MAX_PATH);
    return std::string(path);
}

bool GitHubUpdater::applyUpdate(const std::string& new_file, const std::string& current_file) {
    fmt::print("\n\r Applying update..");
    
    /* Windows: Use batch script to replace executable after exit */
    std::string batch_script = R"(
    @echo off
    timeout /t 2 /nobreak >nul
    move ")" + new_file + R"(" ")" + current_file + R"("
    start "" ")" + current_file + R"("
    del "%~f0"
    )";
    
    std::ofstream batch_file("update.bat");
    batch_file << batch_script;
    batch_file.close();
    
    /* Execute batch script and exit */
    ShellExecuteA(NULL, "open", "update.bat", NULL, NULL, SW_HIDE);
    fmt::print("\r Applying update : ");
    fmt::print(fmt::fg(fmt::color::lime_green), "OK!\n\n");
    std::exit(0);
    
    return true;
}

bool GitHubUpdater::checkAndUpdate(bool auto_update) {
    std::cout << "\n Checking for updates..." << std::endl;
    
    auto release = checkForUpdate();
    if (!release.has_value()) {
        std::cout << " No updates available.\n" << std::endl;
        return false;
    }
    
    fmt::print(" New version available : ");
    const std::string TAG_NAME = release->tag_name;
    fmt::print(fmt::fg(fmt::color::lime_green), TAG_NAME);
    fmt::print(" Release Notes : https://github.com/Danushka-Madushan/animepahe-cli/releases/tag/{}", TAG_NAME);

    if (!auto_update) {
        std::cout << "\n\n Do you want to update? (y/n): ";
        char choice;
        std::cin >> choice;
        if (choice != 'y' && choice != 'Y') {
            return false;
        }
    }
    
    return performUpdate(release.value());
}

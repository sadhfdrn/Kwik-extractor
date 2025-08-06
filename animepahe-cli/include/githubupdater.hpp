#ifndef GITHUB_UPDATER_HPP
#define GITHUB_UPDATER_HPP

#include <string>
#include <vector>
#include <optional>
#include <functional>

class GitHubUpdater {
public:
    struct Release {
        std::string tag_name;
        std::string name;
        std::string body;
        bool prerelease;
        std::vector<std::pair<std::string, std::string>> assets; /* name, download_url */
    };

    GitHubUpdater(
        const std::string& owner,
        const std::string& name,
        const std::string& version,
        const std::string& token = ""
    );
    
    /* Check for latest release */
    std::optional<Release> checkForUpdate();
    
    /* Check and update if available */
    bool checkAndUpdate(bool auto_update = false);
    
    /* Download file with progress callback */
    bool downloadFile(
        const std::string& url,
        const std::string& filepath,
        std::function<void(double)> progress_callback = nullptr
    );
    
    /* Perform the update */
    bool performUpdate(const Release& release);

private:
    std::string repo_owner;
    std::string repo_name;
    std::string current_version;
    std::string github_token;
    
    /* Compare version strings (simple semantic versioning) */
    bool isNewerVersion(const std::string& latest, const std::string& current);
    
    /* Find the appropriate asset for current platform */
    std::string findPlatformAsset(const Release& release);
    
    /* Get current executable path */
    std::string getCurrentExecutablePath();
    
    /* Apply the update (replace current executable) */
    bool applyUpdate(const std::string& new_file, const std::string& current_file);
};

#endif /* GITHUB_UPDATER_HPP */

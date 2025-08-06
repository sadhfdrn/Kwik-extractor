# AnimePahe CLI (Beta)

[![Build Status](https://github.com/Danushka-Madushan/animepahe-cli/workflows/Build%20and%20Release/badge.svg)](https://github.com/Danushka-Madushan/animepahe-cli/actions)
[![Release](https://img.shields.io/github/v/release/Danushka-Madushan/animepahe-cli?include_prereleases)](https://github.com/Danushka-Madushan/animepahe-cli/releases)
[![License](https://img.shields.io/github/license/Danushka-Madushan/animepahe-cli)](LICENSE)

A command-line interface for downloading anime episodes from AnimePahe.ru with support for batch downloads, episode ranges, quality selection, export functionality, and automatic updates.

## ⚠️ Beta Notice

This is a **beta version** and may encounter issues during operation. The current version has the following limitations:
- Download via cli tool is not yet implementd, but direct links can be saved to links.txt
- Zip feature is not yet available
- Some edge cases may cause unexpected behavior

## 📋 Features

- **Self-Updating**: Automatically update to the latest version with the `--upgrade` argument
- **Quality Selection**: Choose specific video quality (720p, 1080p, etc.) with automatic fallback options including lowest (-1) and maximum (0) quality settings
- **Batch Downloads**: Download multiple episodes or entire series
- **Episode Range Selection**: Choose specific episode ranges for targeted downloads
- **Export Functionality**: Generate download links without downloading with custom filename support
- **Archive Support**: Compress downloaded episodes into ZIP archives
- **Windows Native**: Optimized Windows executable with potential Linux support in the future
- **Reliable Link Extraction**: Guaranteed direct link extraction for all episodes
- **Universal Compatibility**: Works with all anime series from AnimePahe.ru

## 🚀 Installation

### Windows
1. Download the latest `animepahe-cli-beta.exe` from the [Releases](https://github.com/yourusername/animepahe-cli/releases) page
2. Place the executable in your desired directory
3. Open Command Prompt or PowerShell in that directory

### Building from Source
```bash
git clone https://github.com/yourusername/animepahe-cli.git
cd animepahe-cli
mkdir build && cd build
cmake .. -DCMAKE_BUILD_TYPE=Release
cmake --build . --config Release
```

## 📖 Usage

### Command Syntax
```
animepahe-cli-beta.exe [OPTIONS]
```

### Standalone Arguments
| Argument | Description | Example |
|----------|-------------|---------|
| `--upgrade` | Update to the latest version (can be used alone) | `animepahe-cli-beta.exe --upgrade` |

### Required Arguments
| Flag | Long Form | Description | Example |
|------|-----------|-------------|---------|
| `-l` | `--link` | Valid AnimePahe.ru anime URL | `"https://animepahe.ru/anime/dcb2b21f-a70d-84f7-fbab-580701484066"` |

### Optional Arguments
| Flag | Long Form | Description | Example |
|------|-----------|-------------|---------|
| `-e` | `--episodes` | Episode selection (`all` or range like `1-12`). Defaults to `all` if not provided | `all`, `1-12`, `5-25` |
| `-q` | `--quality` | Target video quality (`-1` for lowest, `0` for max, or custom like `720`, `1080`) | `-1`, `0`, `720`, `1080`, `360` |
| `-x` | `--export` | Export download links to file (cancels download) | |
| `-f` | `--filename` | Custom filename for exported file (use with `-x`) | `"akame-ga-kill-links.txt"` |
| `-z` | `--zip` | Compress all downloaded episodes into a single ZIP archive | |

### Examples

#### Update to Latest Version
```bash
animepahe-cli-beta.exe --upgrade
```

#### Download All Episodes (Default Behavior)
```bash
animepahe-cli-beta.exe -l "https://animepahe.ru/anime/dcb2b21f-a70d-84f7-fbab-580701484066"
```

#### Download All Episodes (Explicit)
```bash
animepahe-cli-beta.exe -l "https://animepahe.ru/anime/dcb2b21f-a70d-84f7-fbab-580701484066" -e all
```

#### Download Specific Episode Range
```bash
animepahe-cli-beta.exe -l "https://animepahe.ru/anime/dcb2b21f-a70d-84f7-fbab-580701484066" -e 1-12
```

#### Download with Specific Quality
```bash
animepahe-cli-beta.exe -l "https://animepahe.ru/anime/dcb2b21f-a70d-84f7-fbab-580701484066" -q 720
```

#### Download with Lowest Quality
```bash
animepahe-cli-beta.exe -l "https://animepahe.ru/anime/dcb2b21f-a70d-84f7-fbab-580701484066" -e 1-12 -q -1
```

#### Download with Maximum Quality
```bash
animepahe-cli-beta.exe -l "https://animepahe.ru/anime/dcb2b21f-a70d-84f7-fbab-580701484066" -e 1-12 -q 0
```

#### Export Download Links Only
```bash
animepahe-cli-beta.exe -l "https://animepahe.ru/anime/dcb2b21f-a70d-84f7-fbab-580701484066" -x
```

#### Export All Episodes Links (Explicit)
```bash
animepahe-cli-beta.exe -l "https://animepahe.ru/anime/dcb2b21f-a70d-84f7-fbab-580701484066" -e all -x
```

#### Export Links with Custom Filename
```bash
animepahe-cli-beta.exe -l "https://animepahe.ru/anime/dcb2b21f-a70d-84f7-fbab-580701484066" -x -f "akame-ga-kill-links.txt"
```

#### Download and Create ZIP Archive
```bash
animepahe-cli-beta.exe -l "https://animepahe.ru/anime/dcb2b21f-a70d-84f7-fbab-580701484066" -e 1-24 -z
```

#### Download with Quality and ZIP Archive
```bash
animepahe-cli-beta.exe -l "https://animepahe.ru/anime/dcb2b21f-a70d-84f7-fbab-580701484066" -e 1-24 -q 1080 -z
```

## 🔧 Technical Details

### Self-Updating Feature
- Use `--upgrade` to automatically download and install the latest version
- The upgrade argument can be used independently without any other flags
- Automatically checks for updates and replaces the current executable
- Maintains backward compatibility with existing configurations

### Episode Selection
- **Default behavior**: When `-e` or `--episodes` is not provided, all episodes are downloaded
- **`all`**: Explicitly downloads all available episodes
- **Range format**: Use formats like `1-12` or `5-25` for specific episode ranges
- Episode selection applies to both download and export operations

### Quality Selection
- **`-1`**: Selects the lowest available quality
- **`0`**: Selects the maximum available quality (default behavior)
- **Custom values**: Specify target quality without the 'p' suffix (e.g., `720`, `1080`, `360`)
- If no quality is specified, automatically falls back to maximum available quality
- If a custom quality is not available, the tool automatically falls back to the maximum available quality
- All downloads maintain Japanese audio by default

### Export Functionality
- Use `-x` or `--export` to generate download links without downloading
- Default export filename is `links.txt`
- Use `-f` or `--filename` with `-x` to specify a custom export filename
- Custom filename can include path information for organized exports
- When episodes are not specified with export, all episodes are exported by default

### Platform Support
- **Windows**: Fully supported with native executable
- **Linux**: Potential future support under consideration
- **macOS**: Not supported and no plans for support

### Dependencies
- **CPR**: HTTP client library for C++
- **FMT**: Modern formatting library
- **RE2**: Regular expression engine
- **Abseil**: Google's C++ common libraries
- **cxxopts**: Command line argument parsing
- **PugiXML**: XML processing library
- **nlohmann/json**: JSON parsing library

### Build Requirements
- CMake 3.5 or higher
- C++20 compatible compiler
- Git (for dependency fetching)
- Windows development environment

## 🐛 Known Issues

- Network timeouts may occur with slow connections
- Large batch downloads may consume significant system resources
- Update feature requires internet connection and appropriate permissions

## 🤝 Contributing

Contributions are welcome! Please feel free to submit issues, feature requests, or pull requests.

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the DMNML v1.0 (Danushka-Madushan No Modification License).  
You are allowed to use this software commercially or personally, but you may not modify, redistribute, or create derivative works.
see the [LICENSE](LICENSE) file for details.

## ⚖️ Disclaimer

This tool is for educational purposes only. Users are responsible for complying with AnimePahe.ru's terms of service and applicable copyright laws. The developers do not condone piracy or copyright infringement.

## 🔗 Links

- [AnimePahe.ru](https://animepahe.ru) - Source website
- [Issues](https://github.com/yourusername/animepahe-cli/issues) - Bug reports and feature requests
- [Releases](https://github.com/yourusername/animepahe-cli/releases) - Download latest versions

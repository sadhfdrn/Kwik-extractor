cmake_minimum_required(VERSION 3.5...3.30)
project(AnimepaheCLI VERSION 0.1.7 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CPR_USE_SYSTEM_CURL ON)
# Configure Abseil options before making it available
set(ABSL_PROPAGATE_CXX_STD ON)
set(ABSL_ENABLE_INSTALL ON)

include(FetchContent)

# Fetch Abseil first (required by RE2)
FetchContent_Declare(
  absl
  GIT_REPOSITORY https://github.com/abseil/abseil-cpp.git
  GIT_TAG        20240116.2  # Use a stable release tag
)

# Fetch RE2
FetchContent_Declare(
	re2
  GIT_REPOSITORY https://github.com/google/re2.git
	GIT_TAG        2024-04-01  # Use a stable release tag
)

# FMT
FetchContent_Declare(
  fmt
  GIT_REPOSITORY https://github.com/fmtlib/fmt.git
  GIT_TAG        e69e5f977d458f2650bb346dadf2ad30c5320281 # v10.2.1
)

# CPR
FetchContent_Declare(
  cpr
  GIT_REPOSITORY https://github.com/libcpr/cpr.git
  GIT_TAG        1.10.5
)

# cxxopts
FetchContent_Declare(
  cxxopts
  GIT_REPOSITORY https://github.com/jarro2783/cxxopts.git
  GIT_TAG        v3.1.1
)

FetchContent_Declare(
  pugixml
  GIT_REPOSITORY https://github.com/zeux/pugixml.git
  GIT_TAG v1.15 # Or a specific release tag like v1.13
)

FetchContent_Declare(
  json
  GIT_REPOSITORY https://github.com/nlohmann/json.git
  GIT_TAG v3.12.0
)

FetchContent_MakeAvailable(absl re2 cxxopts fmt cpr pugixml json)

add_executable(
  animepahe-cli-beta

  main.cpp
  libs/utils.cpp
  libs/animepahe.cpp
  libs/kwikpahe.cpp
  libs/githubupdater.cpp
  libs/downloader.cpp
  resource.rc
)

target_include_directories(animepahe-cli-beta
  PRIVATE
  ${CMAKE_SOURCE_DIR}/include
)

target_link_libraries(animepahe-cli-beta
  PRIVATE
  pugixml
  cpr::cpr
  fmt::fmt
  re2::re2
  cxxopts::cxxopts
  nlohmann_json::nlohmann_json
)

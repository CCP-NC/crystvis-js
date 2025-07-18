# Changelog

All notable changes to crystvis-js will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.6.0] - 2025-07-18

### Changed
- Updated Three.js from version 0.137 to 0.178
- Fixed color handling across all primitives to work with new Three.js color management
- Fixed shader handling for GLSL 3.0 compatibility
- Improved text rendering with better color handling and transparency
- Refined material properties for better appearance in the new renderer

### Added
- Documentation on Three.js migration
- Improved error handling for shader compilation
- Better color space handling for all primitives

### Fixed
- Color issues when upgrading to Three.js 0.178
- Text rendering and transparency problems
- Shader compilation errors with GLSL 3.0
- EllipsoidMesh color handling with different material types
- Proper handling of atoms and bond materials

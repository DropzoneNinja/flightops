MEDIA.md
Shared Media Gallery for Paramotor Flight Days

Overview
This document defines the Media Gallery feature for the Paramotor Flight Sites application.

The Media Gallery allows users to upload, browse, and view photos and videos from flight days, organised by calendar date. Media is shared publicly within the app, with metadata describing the uploader, pilots involved, and optional notes.

The system must support:
- Date-based discovery using a calendar
- Image and video previews
- In-browser playback
- Secure file storage using a Docker-configured directory
- Metadata stored in PostgreSQL

Goals and Principles
- Chronological discovery so users find media by flight date
- Low friction uploads with minimal required fields
- Media-first user experience with thumbnails and previews
- Stateless frontend with all metadata persisted in the database
- Docker-native storage using a .env-defined path
- Designed for future extensibility

Media Storage Architecture

File Storage
Media files are stored on disk inside a directory defined by a Docker environment variable.
The application must not hardcode any file paths.

Environment Variable
MEDIA_STORAGE_PATH=/data/media

Docker Compose Requirement
The application container mounts MEDIA_STORAGE_PATH into the container and uses it as the root media directory.

On-Disk Directory Structure
/media
 └── YYYY-MM-DD
     ├── UUID-filename.jpg
     ├── UUID-filename.mp4

Directory name is the flight date in YYYY-MM-DD format.
Filenames are prefixed with a UUID to avoid collisions.
The original filename is preserved in the database.

Database Schema

Table name: media

Columns:
- id: UUID, primary key, generated server-side
- flight_date: DATE, used for calendar grouping
- media_type: ENUM with values image or video
- file_path: TEXT, relative to MEDIA_STORAGE_PATH
- original_filename: TEXT
- uploaded_by: TEXT, name of uploader
- pilots: TEXT ARRAY, list of pilot names
- notes: TEXT, optional description
- mime_type: TEXT
- file_size: BIGINT, bytes
- created_at: TIMESTAMP

Frontend Pages and Behaviour

Media Calendar Page
Route: /media

Purpose:
- Display a monthly calendar
- Highlight days that contain photos or videos

Requirements:
- Month-based calendar view
- Days with media are visually marked
- Clicking a day navigates to that day’s media gallery

API endpoint:
GET /api/media/dates

Response example:
2026-02-14
2026-02-22

Daily Media Gallery Page
Route: /media/YYYY-MM-DD

Purpose:
- Display all photos and videos for a selected flight day

User interface requirements:
- Responsive grid layout
- Thumbnails for images
- Video thumbnails with a play indicator
- Each media item shows:
  - Thumbnail
  - Uploaded by
  - Pilot or pilots shown

API endpoint:
GET /api/media?date=YYYY-MM-DD

Media Viewer

Image Viewer:
- Displays full-resolution image
- Optional zoom and pan
- Download option

Video Viewer:
- HTML5 video player in browser
- Controls include play, pause, seek, volume, and fullscreen
- Download option

Media delivery:
GET /api/media/{id}/file

Video streaming must be supported.

Upload Media

Upload access:
- Available from the calendar page and daily gallery page

Upload fields:
- Flight date (required)
- Media file (required)
- Uploaded by (required)
- Pilots in media (optional, multiple values)
- Notes (optional)

Client-side validation:
- Image types allowed: jpg, jpeg, png, webp
- Video types allowed: mp4, webm, mov
- Maximum file size enforced

API endpoint:
POST /api/media

Multipart form fields:
- file
- flight_date
- uploaded_by
- pilots[]
- notes

API Summary

GET /api/media/dates
Returns all dates that contain media.

GET /api/media?date=YYYY-MM-DD
Returns metadata for all media on a given day.

GET /api/media/{id}
Returns metadata for a single media item.

GET /api/media/{id}/file
Returns the actual media file.

POST /api/media
Uploads a new image or video.

Security and Validation

- File extension and MIME type must both be validated
- Files must be stored outside the public web root
- Media must only be accessible through backend routes
- Original filenames must never be used as storage filenames
- Maximum upload size enforced server-side

UX and Performance Considerations

- Lazy-load thumbnails
- Use generated thumbnails for videos where possible
- Paginate or virtualise if many items exist on a single day
- Mobile-friendly layout
- Keyboard navigation for media viewer

Future Enhancements (Out of Scope)

- Comments on media
- Likes or reactions
- Pilot profiles
- Admin moderation and deletion
- EXIF or video metadata extraction
- Automatic linking to paramotor flight logs

Definition of Done

- Media storage path is controlled by docker-compose .env
- Calendar highlights days with available media
- Users can upload images and videos with metadata
- Media can be viewed and downloaded in the browser
- Metadata persists across container restarts
- Fully functional within the existing React, PostgreSQL, docker-compose stack
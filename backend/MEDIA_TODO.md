# Media Gallery Implementation Plan
**Paramotor Flight Sites - Shared Media Gallery Feature**

---

## Executive Summary

This document outlines the implementation plan for a date-based media gallery feature that allows paramotor pilots to upload, browse, and share photos and videos from flight days. The feature integrates with the existing React + NestJS + PostgreSQL + Docker stack.

---

## Design Vision & Aesthetic Direction

### Conceptual Direction: **Sky Archive Editorial**

A refined, magazine-style interface that celebrates paramotor flight photography with a focus on chronological storytelling and visual impact.

### Design Principles

**Tone**: Editorial minimalism with dramatic photography presentation
- Clean, spacious layouts that prioritize media content
- Subtle animations that feel like turning pages in a photo journal
- Typography that balances readability with character
- Color palette inspired by sky gradients and aviation aesthetics

**Typography Strategy**:
- **Display Font**: "Outfit" or "Manrope" - modern geometric sans with clean lines
- **Body Font**: "Inter Variable" or "DM Sans" - highly readable for metadata
- **Accent Font**: "JetBrains Mono" - for dates and technical details

**Color Palette** (Sky Archive Theme):
```css
--sky-dawn: #FFB5A7;       /* Soft coral for accents */
--sky-morning: #87CEEB;    /* Sky blue for primary elements */
--sky-midday: #E8F4F8;     /* Pale blue for backgrounds */
--sky-dusk: #4A5568;       /* Slate gray for text */
--sky-night: #1A202C;      /* Deep navy for headers */
--sky-cloud: #F7FAFC;      /* Almost white for cards */
--elevation-shadow: rgba(74, 85, 104, 0.1);
```

**Visual Elements**:
- Generous white space and breathing room
- Subtle drop shadows for depth (elevation-based)
- Smooth page transitions with staggered reveals
- Lazy-loaded images with skeleton placeholders
- Video thumbnails with elegant play overlays
- Calendar dates with visual indicators (dots, halos)

**Motion Design**:
- Page load: Staggered fade-in for media items (100ms delay between items)
- Calendar interaction: Smooth scale transform on date hover
- Media viewer: Elegant slide-in from bottom with backdrop blur
- Upload modal: Graceful scale-up from center
- Scroll: Parallax effect on hero sections (optional)

---

## Technical Architecture

### Tech Stack Integration

**Backend**:
- NestJS framework
- TypeORM with PostgreSQL
- Multer for multipart form handling
- Sharp (new dependency) for image thumbnail generation
- FFmpeg (via fluent-ffmpeg) for video thumbnail generation

**Frontend**:
- React 18 with TypeScript
- React Router DOM for navigation
- Zustand for client state (upload progress, viewer state)
- TanStack React Query for server state caching
- Tailwind CSS for styling
- date-fns for date formatting
- react-virtuoso (new dependency) for virtualized media grid
- framer-motion (new dependency) for animations

**Infrastructure**:
- Docker Compose with new volume mount for media storage
- PostgreSQL database with new migration
- Environment-based storage path configuration

---

## Backend Implementation Plan

### 1. Database Schema

**New Entity**: `Media` ([backend/src/database/entities/media.entity.ts](backend/src/database/entities/media.entity.ts))

```typescript
@Entity('media')
export class Media {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'date' })
  @Index()
  flight_date: Date;

  @Column({
    type: 'enum',
    enum: ['image', 'video']
  })
  media_type: 'image' | 'video';

  @Column({ type: 'text' })
  file_path: string; // Relative to MEDIA_STORAGE_PATH

  @Column({ type: 'text' })
  original_filename: string;

  @Column({ type: 'text' })
  uploaded_by: string;

  @Column({ type: 'text', array: true, default: [] })
  pilots: string[];

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ type: 'text' })
  mime_type: string;

  @Column({ type: 'bigint' })
  file_size: number;

  @Column({ type: 'text', nullable: true })
  thumbnail_path: string; // Generated thumbnail for videos and images

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
```

**Migration**: Create TypeORM migration for the media table
- Run: `npm run migration:generate -- CreateMediaTable`
- Review and run: `npm run migration:run`

### 2. API Endpoints

**Module Structure**:
```
backend/src/media/
├── media.module.ts
├── media.controller.ts
├── media.service.ts
├── dto/
│   ├── create-media.dto.ts
│   └── query-media.dto.ts
└── guards/
    └── file-validation.guard.ts
```

**MediaController** ([backend/src/media/media.controller.ts](backend/src/media/media.controller.ts)):

```typescript
@Controller('media')
@UseGuards(JwtAuthGuard)
export class MediaController {

  @Get('dates')
  getMediaDates(@CurrentUser() user: User): Promise<string[]>
  // Returns: ["2026-02-14", "2026-02-22"]

  @Get()
  getMediaByDate(
    @Query('date') date: string,
    @CurrentUser() user: User
  ): Promise<Media[]>
  // Returns: Array of media metadata for specific date

  @Get(':id')
  getMediaMetadata(
    @Param('id') id: string,
    @CurrentUser() user: User
  ): Promise<Media>

  @Get(':id/file')
  async getMediaFile(
    @Param('id') id: string,
    @Res() res: Response,
    @CurrentUser() user: User
  )
  // Streams file with proper Content-Type and Range support

  @Get(':id/thumbnail')
  async getMediaThumbnail(
    @Param('id') id: string,
    @Res() res: Response,
    @CurrentUser() user: User
  )
  // Serves generated thumbnail

  @Post()
  @UseInterceptors(FileInterceptor('file'))
  async uploadMedia(
    @UploadedFile() file: Express.Multer.File,
    @Body() createMediaDto: CreateMediaDto,
    @CurrentUser() user: User
  ): Promise<Media>

  @Delete(':id')
  @UseGuards(AdminGuard) // Optional: Only admins can delete
  async deleteMedia(
    @Param('id') id: string,
    @CurrentUser() user: User
  )
}
```

### 3. Media Service Implementation

**Key Responsibilities**:
- File validation (MIME type, extension, size)
- Secure file storage with UUID prefix
- Thumbnail generation for images and videos
- Directory management (create YYYY-MM-DD folders)
- File streaming with Range header support
- File cleanup on deletion

**Critical Security Measures**:
```typescript
// File validation pipe
validateFile(file: Express.Multer.File) {
  const allowedImageTypes = ['image/jpeg', 'image/png', 'image/webp'];
  const allowedVideoTypes = ['video/mp4', 'video/webm', 'video/quicktime'];
  const maxSize = 500 * 1024 * 1024; // 500MB

  // Validate MIME type AND extension
  // Never trust client-provided MIME type alone
  // Use file-type library for magic number validation
}

// Secure filename generation
generateSecureFilename(originalName: string): string {
  const uuid = randomUUID();
  const ext = path.extname(originalName);
  return `${uuid}${ext}`;
}
```

**Thumbnail Generation Strategy**:
- **Images**: Use Sharp to generate 400x300 thumbnails (preserve aspect ratio)
- **Videos**: Use fluent-ffmpeg to extract frame at 1 second mark
- Store thumbnails in `MEDIA_STORAGE_PATH/thumbnails/YYYY-MM-DD/`

### 4. Environment Configuration

**New Environment Variables**:
```bash
# .env
MEDIA_STORAGE_PATH=/data/media
MAX_UPLOAD_SIZE=524288000  # 500MB in bytes
```

**Docker Compose Updates**:
```yaml
backend:
  environment:
    MEDIA_STORAGE_PATH: /app/media
    MAX_UPLOAD_SIZE: ${MAX_UPLOAD_SIZE:-524288000}
  volumes:
    - ${MEDIA_STORAGE_PATH:-./media}:/app/media
    - ${BACKUP_DIR:-./backups}:/backups
```

### 5. Dependencies to Add

```bash
cd backend
npm install sharp fluent-ffmpeg file-type
npm install --save-dev @types/fluent-ffmpeg @types/multer
```

---

## Frontend Implementation Plan

### 1. Routing Structure

**Add to App.tsx**:
```typescript
<Route
  path="/media"
  element={
    <ProtectedRoute>
      <MediaCalendar />
    </ProtectedRoute>
  }
/>
<Route
  path="/media/:date"
  element={
    <ProtectedRoute>
      <DailyGallery />
    </ProtectedRoute>
  }
/>
```

### 2. Component Architecture

```
frontend/src/
├── pages/
│   ├── MediaCalendar.tsx        # Main calendar view
│   └── DailyGallery.tsx         # Daily media grid
├── components/
│   └── Media/
│       ├── CalendarView.tsx     # Calendar component with highlighted dates
│       ├── MediaGrid.tsx        # Virtualized media grid
│       ├── MediaCard.tsx        # Individual media thumbnail card
│       ├── MediaViewer.tsx      # Full-screen image/video viewer
│       ├── UploadModal.tsx      # Upload form modal
│       ├── VideoPlayer.tsx      # HTML5 video player with controls
│       └── ImageViewer.tsx      # Zoomable image viewer
├── hooks/
│   ├── useMediaDates.ts         # React Query hook for dates
│   ├── useMediaByDate.ts        # React Query hook for daily media
│   └── useMediaUpload.ts        # Upload mutation hook
└── stores/
    └── mediaStore.ts            # Zustand store for UI state
```

### 3. State Management Strategy

**Server State** (React Query):
```typescript
// hooks/useMediaDates.ts
export function useMediaDates() {
  return useQuery({
    queryKey: ['media', 'dates'],
    queryFn: () => api.get('/media/dates'),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// hooks/useMediaByDate.ts
export function useMediaByDate(date: string) {
  return useQuery({
    queryKey: ['media', 'date', date],
    queryFn: () => api.get(`/media?date=${date}`),
    enabled: !!date,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

// hooks/useMediaUpload.ts
export function useMediaUpload() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (formData: FormData) =>
      api.post('/media', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (e) => {
          // Update Zustand store with progress
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries(['media']);
    },
  });
}
```

**Client State** (Zustand):
```typescript
// stores/mediaStore.ts
interface MediaStore {
  // Viewer state
  viewerOpen: boolean;
  currentMediaId: string | null;

  // Upload state
  uploadModalOpen: boolean;
  uploadProgress: number;

  // Actions
  openViewer: (mediaId: string) => void;
  closeViewer: () => void;
  openUploadModal: () => void;
  closeUploadModal: () => void;
  setUploadProgress: (progress: number) => void;
}
```

### 4. Page Components

#### MediaCalendar Page ([frontend/src/pages/MediaCalendar.tsx](frontend/src/pages/MediaCalendar.tsx))

**Features**:
- Monthly calendar view with previous/next navigation
- Highlighted dates that contain media (using dots or subtle backgrounds)
- Click date to navigate to `/media/YYYY-MM-DD`
- Floating action button (FAB) to open upload modal
- Mobile-responsive grid layout

**Implementation Notes**:
- Use date-fns for calendar logic (startOfMonth, endOfMonth, eachDayOfInterval)
- Fetch media dates on mount with React Query
- Apply CSS Grid for calendar layout (7 columns for days of week)
- Staggered fade-in animation for calendar cells

#### DailyGallery Page ([frontend/src/pages/DailyGallery.tsx](frontend/src/pages/DailyGallery.tsx))

**Features**:
- Responsive masonry grid or uniform grid of media thumbnails
- Back button to return to calendar
- Date header with formatted display (e.g., "Saturday, February 22, 2026")
- Upload button for the current date
- Lazy-loaded images with skeleton placeholders
- Video thumbnails with play icon overlay

**Performance Optimizations**:
- Use react-virtuoso for virtualized scrolling if >50 items
- Implement intersection observer for lazy image loading
- Preload next/previous day's data on scroll approach
- Use WebP thumbnails when supported

### 5. Component Details

#### MediaViewer Component ([frontend/src/components/Media/MediaViewer.tsx](frontend/src/components/Media/MediaViewer.tsx))

**Features**:
- Full-screen overlay with backdrop blur
- Keyboard navigation (arrow keys for prev/next, Escape to close)
- Touch gestures for mobile (swipe to navigate)
- Display metadata: uploaded by, pilots, notes
- Download button
- Close button (top-right)

**Image Viewer**:
- Pinch-to-zoom on mobile
- Click to zoom on desktop
- Pan when zoomed

**Video Player**:
- HTML5 video element with custom controls
- Play/pause, seek bar, volume control, fullscreen
- Preload metadata only (not full video)

#### UploadModal Component ([frontend/src/components/Media/UploadModal.tsx](frontend/src/components/Media/UploadModal.tsx))

**Form Fields**:
- Flight date picker (default to selected date or today)
- File input with drag-and-drop zone
- Uploaded by (text input, pre-filled with user's name)
- Pilots (multi-input field - can add multiple names)
- Notes (textarea, optional)

**Client-Side Validation**:
```typescript
const validateFile = (file: File) => {
  const allowedTypes = [
    'image/jpeg', 'image/jpg', 'image/png', 'image/webp',
    'video/mp4', 'video/webm', 'video/quicktime'
  ];

  const maxSize = 500 * 1024 * 1024; // 500MB

  if (!allowedTypes.includes(file.type)) {
    throw new Error('Invalid file type');
  }

  if (file.size > maxSize) {
    throw new Error('File too large (max 500MB)');
  }
};
```

**Upload Progress**:
- Linear progress bar
- Percentage display
- Cancel button (AbortController)

### 6. Styling Implementation

**Tailwind CSS Custom Configuration** (extend existing):
```javascript
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      fontFamily: {
        display: ['Outfit', 'sans-serif'],
        body: ['Inter Variable', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      colors: {
        sky: {
          dawn: '#FFB5A7',
          morning: '#87CEEB',
          midday: '#E8F4F8',
          dusk: '#4A5568',
          night: '#1A202C',
          cloud: '#F7FAFC',
        },
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-out',
        'slide-up': 'slideUp 0.4s ease-out',
        'scale-in': 'scaleIn 0.3s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        scaleIn: {
          '0%': { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
      },
    },
  },
};
```

### 7. Dependencies to Add

```bash
cd frontend
npm install react-virtuoso framer-motion
npm install --save-dev @types/react-virtuoso
```

---

## Performance Optimization Strategy

### Backend Performance

1. **Database Indexing**:
   - Index on `flight_date` for fast date queries
   - Consider composite index on `(flight_date, media_type)` if filtering by type

2. **File Streaming**:
   - Implement HTTP Range header support for video streaming
   - Use Node.js streams for large file delivery
   - Set proper Cache-Control headers

3. **Thumbnail Generation**:
   - Generate thumbnails asynchronously after upload
   - Cache generated thumbnails
   - Consider background job queue for large videos

4. **Query Optimization**:
   - Limit results per day (pagination if >100 items)
   - Select only necessary fields for list views
   - Use database aggregation for date counting

### Frontend Performance

1. **Image Optimization**:
   - Use `loading="lazy"` on img elements
   - Implement progressive image loading (blur-up technique)
   - Serve WebP with JPEG fallback
   - Use responsive image sizes with srcset

2. **List Virtualization**:
   - Use react-virtuoso for media grids with >30 items
   - Implement infinite scroll for pagination
   - Maintain scroll position on navigation back

3. **Code Splitting**:
   - Lazy load MediaViewer component
   - Lazy load UploadModal component
   - Split media page routes from main bundle

4. **Caching Strategy**:
   - React Query stale-while-revalidate pattern
   - Cache thumbnails in browser with long max-age
   - Implement service worker for offline thumbnail viewing (future)

5. **Animation Performance**:
   - Use CSS transforms (not position properties)
   - Limit animations to opacity and transform
   - Use will-change sparingly
   - Disable animations on low-end devices

6. **Bundle Size**:
   - Use date-fns with tree-shaking (import specific functions)
   - Lazy load framer-motion components
   - Avoid importing entire icon libraries

---

## Mobile Responsiveness

### Design Adaptations

**Mobile (<768px)**:
- Stack calendar in compact view with week rows
- Single-column media grid with full-width cards
- Bottom sheet for upload modal (slide up from bottom)
- Touch-friendly tap targets (min 44px)
- Swipeable media viewer

**Tablet (768px - 1024px)**:
- 2-3 column media grid
- Larger calendar cells
- Modal-based upload form

**Desktop (>1024px)**:
- 4-6 column media grid
- Full calendar month view
- Centered modal dialogs
- Hover effects and tooltips

### Mobile-Specific Components

Reuse existing mobile patterns from the codebase:
- `BottomSheet` component for upload modal on mobile
- `BottomNavigationBar` integration with new media tab
- Touch gesture support with `react-swipeable`

---

## Security Considerations

### Backend Security

1. **File Upload Validation**:
   - Validate MIME type using magic numbers (file-type library)
   - Check file extension whitelist
   - Enforce maximum file size server-side
   - Scan for malicious content (optional: ClamAV)

2. **Access Control**:
   - All endpoints require JWT authentication
   - Verify user permissions before file access
   - Rate limit upload endpoint (e.g., 10 uploads per hour)

3. **Storage Security**:
   - Store files outside web root
   - Never expose internal file paths to client
   - Use UUIDs for file identification
   - Set proper directory permissions (750)

4. **Input Sanitization**:
   - Sanitize uploaded_by, pilots, and notes fields
   - Prevent XSS in metadata
   - Validate date formats strictly

### Frontend Security

1. **XSS Prevention**:
   - Sanitize user-generated content (notes, pilot names)
   - Use React's built-in escaping for display
   - Implement Content Security Policy headers

2. **File Upload UX**:
   - Show clear error messages for invalid files
   - Prevent multiple simultaneous uploads
   - Validate file size before upload (save bandwidth)

---

## Testing Strategy

### Backend Tests

1. **Unit Tests**:
   - MediaService file validation logic
   - Thumbnail generation functions
   - Filename sanitization

2. **Integration Tests**:
   - Upload endpoint with mock files
   - File streaming with Range headers
   - Database queries for date ranges

3. **E2E Tests**:
   - Full upload flow (auth → upload → verify)
   - File download and streaming
   - Thumbnail generation pipeline

### Frontend Tests

1. **Component Tests**:
   - Calendar date highlighting
   - Media grid rendering
   - Upload form validation

2. **Integration Tests**:
   - Navigation between calendar and gallery
   - Upload flow with progress tracking
   - Media viewer keyboard navigation

3. **Visual Regression Tests**:
   - Calendar layout across breakpoints
   - Media grid responsiveness
   - Upload modal appearance

---

## Deployment Checklist

### Pre-Deployment

- [ ] Run database migration in production
- [ ] Create media storage directory with correct permissions
- [ ] Update Docker Compose configuration
- [ ] Set environment variables in production .env
- [ ] Test file upload with max size files
- [ ] Verify thumbnail generation for all supported formats
- [ ] Test video streaming on mobile devices
- [ ] Run security audit on file upload endpoints

### Post-Deployment Monitoring

- [ ] Monitor media storage disk usage
- [ ] Track upload success/failure rates
- [ ] Monitor API response times for media endpoints
- [ ] Check error logs for file processing failures
- [ ] Verify thumbnail generation queue processing

---

## Future Enhancements (Out of Scope)

These features are explicitly **not included** in the initial implementation but documented for future consideration:

1. **Social Features**:
   - Comments on media items
   - Likes or reactions
   - Sharing media externally

2. **Advanced Features**:
   - Pilot profile pages
   - EXIF metadata extraction
   - Automatic geotagging
   - Linking media to flight logs

3. **Moderation**:
   - Admin deletion workflow
   - Flagging inappropriate content
   - Bulk media management

4. **Performance**:
   - CDN integration for media delivery
   - Progressive video streaming (HLS/DASH)
   - Image optimization pipeline (multiple sizes)

---

## Implementation TODO List

### Phase 1: Backend Foundation (Days 1-3) ✅ COMPLETED

#### Database Setup
- [x] Create Media entity file ([backend/src/database/entities/media.entity.ts](backend/src/database/entities/media.entity.ts))
- [x] Generate TypeORM migration: `npm run migration:generate -- CreateMediaTable`
- [x] Review generated migration for correctness
- [x] Run migration: `npm run migration:run`
- [x] Verify table creation in PostgreSQL

#### Media Module Scaffolding
- [x] Create media module: `nest g module media`
- [x] Create media service: `nest g service media`
- [x] Create media controller: `nest g controller media`
- [x] Create DTOs directory and files:
  - [x] `create-media.dto.ts`
  - [x] `query-media.dto.ts`

#### File Storage Setup
- [x] Install dependencies: `npm install sharp fluent-ffmpeg file-type`
- [x] Install dev dependencies: `npm install --save-dev @types/fluent-ffmpeg @types/multer`
- [x] Add MEDIA_STORAGE_PATH to .env
- [x] Add MAX_UPLOAD_SIZE to .env
- [x] Update docker-compose.yml with media volume mount
- [x] Create media storage directory structure helper (in MediaService)
- [x] Create secure filename generation utility (in MediaService)
- [x] Register MediaModule in app.module.ts

### Phase 2: Backend API Implementation (Days 4-6) ✅ COMPLETED

#### Media Service Core Logic
- [x] Implement file validation (MIME type, extension, size)
- [x] Implement secure file storage logic
- [x] Implement thumbnail generation for images (Sharp)
- [x] Implement thumbnail generation for videos (FFmpeg)
- [x] Implement file cleanup on deletion
- [x] Add error handling and logging

#### API Endpoints
- [x] Implement `GET /media/dates` endpoint
- [x] Implement `GET /media?date=YYYY-MM-DD` endpoint
- [x] Implement `GET /media/:id` endpoint
- [x] Implement `GET /media/:id/file` with streaming support
- [x] Implement `GET /media/:id/thumbnail` endpoint
- [x] Implement `POST /media` upload endpoint with Multer
- [x] Implement `DELETE /media/:id` endpoint (admin only)

#### Security & Validation
- [x] Add file validation (magic number validation with file-type)
- [ ] Implement rate limiting on upload endpoint (deferred - can add later)
- [x] Add JWT auth guard to all endpoints
- [x] Add admin guard to delete endpoint
- [x] Implement input sanitization for text fields (filename sanitization)
- [x] Add Range header support for video streaming (basic support in controller)

#### Testing
- [ ] Write unit tests for file validation
- [ ] Write unit tests for thumbnail generation
- [ ] Write integration tests for upload flow
- [ ] Write integration tests for file streaming
- [ ] Test with various file formats (JPEG, PNG, WebP, MP4, WebM, MOV)

### Phase 3: Frontend Foundation (Days 7-9) ✅ COMPLETED

#### Dependencies & Configuration
- [x] Install frontend dependencies: `npm install react-virtuoso framer-motion`
- [x] Install dev dependencies: `npm install --save-dev @types/react-virtuoso`
- [x] Update Tailwind config with Sky Archive theme colors
- [x] Add custom fonts to index.html (Outfit, Inter Variable, JetBrains Mono)
- [x] Create media-specific Tailwind utilities

#### Routing Setup
- [x] Add `/media` route to App.tsx
- [x] Add `/media/:date` route to App.tsx
- [x] Add ProtectedRoute wrapper to both routes
- [x] Create placeholder page components

#### API Client & Hooks
- [x] Create media API client functions in `src/services/media.service.ts`
- [x] Create `useMediaDates` React Query hook
- [x] Create `useMediaByDate` React Query hook
- [x] Create `useMediaUpload` mutation hook
- [x] Create Zustand media store for UI state

#### Component Structure
- [x] Create `components/Media/` directory
- [x] Create empty component files:
  - [x] CalendarView.tsx
  - [x] MediaGrid.tsx
  - [x] MediaCard.tsx
  - [x] MediaViewer.tsx
  - [x] UploadModal.tsx
  - [x] VideoPlayer.tsx
  - [x] ImageViewer.tsx

### Phase 4: Calendar Implementation (Days 10-11) ✅ COMPLETED

#### MediaCalendar Page
- [x] Implement MediaCalendar page component
- [x] Add calendar header with month/year display
- [x] Add previous/next month navigation buttons
- [x] Implement calendar grid layout (7 columns)
- [x] Generate calendar days using date-fns
- [x] Fetch media dates with useMediaDates hook
- [x] Highlight dates that contain media
- [x] Add click handler to navigate to daily gallery
- [x] Add floating action button (FAB) for upload

#### CalendarView Component
- [x] Implement responsive calendar grid
- [x] Style calendar cells with Sky Archive theme
- [x] Add hover effects on date cells
- [x] Add visual indicators for media-containing dates (dots/halos)
- [x] Implement staggered fade-in animation for cells
- [x] Add loading skeleton for calendar
- [x] Handle empty state (no media uploaded yet)

#### Mobile Responsiveness
- [x] Optimize calendar layout for mobile (<768px)
- [x] Add touch-friendly tap targets
- [x] Test calendar on various screen sizes
- [x] Ensure proper date cell sizing on small screens

### Phase 5: Daily Gallery Implementation (Days 12-14) ✅ COMPLETED

#### DailyGallery Page
- [x] Implement DailyGallery page component
- [x] Add page header with formatted date display
- [x] Add back button to return to calendar
- [x] Fetch media for selected date with useMediaByDate
- [x] Implement media grid layout (responsive columns)
- [x] Add upload button for current date
- [x] Add loading skeleton for media grid
- [x] Handle empty state (no media for this date)

#### MediaGrid Component
- [x] Implement responsive grid layout (1-6 columns based on breakpoint)
- [x] Integrate react-virtuoso for virtualization (if >30 items)
- [x] Implement lazy loading with intersection observer
- [x] Add staggered animation for media card appearance
- [x] Handle grid responsiveness across breakpoints

#### MediaCard Component
- [x] Create thumbnail display with aspect ratio preservation
- [x] Add image lazy loading with blur-up placeholder
- [x] Add video thumbnail with play icon overlay
- [x] Display metadata preview (uploaded by, pilots count)
- [x] Add click handler to open MediaViewer
- [x] Style card with elevation shadow
- [x] Add hover effect (subtle scale transform)

#### Performance Optimization
- [x] Implement image lazy loading
- [ ] Add WebP support with JPEG fallback (backend-dependent)
- [ ] Preload next/previous day's data on approach (deferred)
- [ ] Optimize thumbnail sizes for different breakpoints (backend-dependent)

### Phase 6: Media Viewer Implementation (Days 15-16) ✅ COMPLETED

#### MediaViewer Component
- [x] Create full-screen overlay with backdrop blur
- [x] Implement close button (top-right)
- [x] Add keyboard navigation (Escape to close, arrows for prev/next)
- [x] Implement touch gestures for mobile swipe
- [x] Display media metadata section
- [x] Add download button
- [x] Implement smooth slide-in animation
- [x] Handle viewer state with Zustand store

#### ImageViewer Component
- [x] Display full-resolution image
- [x] Implement zoom on click (desktop)
- [x] Implement pinch-to-zoom (mobile)
- [x] Add pan functionality when zoomed
- [x] Add loading state for high-res images
- [x] Optimize for various image sizes

#### VideoPlayer Component
- [x] Implement HTML5 video element
- [x] Create custom video controls UI
- [x] Add play/pause button
- [x] Add seek bar with progress indicator
- [x] Add volume control
- [x] Add fullscreen button
- [x] Implement preload="metadata" for performance
- [x] Handle video loading states

#### Accessibility
- [x] Add ARIA labels to viewer controls
- [x] Ensure keyboard navigation works completely
- [x] Add focus trap when viewer is open
- [ ] Test with screen readers (requires manual testing)

### Phase 7: Upload Implementation (Days 17-18) ✅ COMPLETED

#### UploadModal Component
- [x] Create modal overlay with scale-in animation
- [x] Implement form layout with all required fields
- [x] Create file input with drag-and-drop zone
- [x] Add flight date picker (default to selected date)
- [x] Add "uploaded by" text input (pre-fill with user name)
- [x] Add pilots multi-input field (dynamic add/remove)
- [x] Add notes textarea (optional)
- [x] Style form with Sky Archive theme

#### File Upload Logic
- [x] Implement file drag-and-drop handler
- [x] Add client-side file validation (type, size)
- [x] Show file preview after selection
- [x] Create FormData for multipart upload
- [x] Integrate with useMediaUpload hook
- [x] Implement upload progress bar
- [x] Add cancel upload button (AbortController)
- [x] Handle upload success (close modal, invalidate queries)
- [x] Handle upload errors (display user-friendly messages)

#### Form Validation
- [x] Validate required fields before submit
- [x] Show field-level error messages
- [x] Validate file type client-side
- [x] Validate file size client-side (500MB max)
- [x] Validate date format
- [x] Disable submit button during upload

#### Mobile Adaptation
- [x] Responsive modal design for all screen sizes
- [x] Optimize form layout for small screens
- [x] File picker works on mobile browsers
- [x] Drag-and-drop with fallback on mobile

### Phase 8: Navigation & Integration (Day 19) ✅ COMPLETED

#### Navigation Updates
- [x] Add "Media" link to main navigation
- [x] Update BottomNavigationBar with media icon
- [x] Ensure proper navigation state management
- [x] Add breadcrumb navigation to daily gallery
- [x] Test deep linking to specific dates

#### Cross-Feature Integration
- [x] Maintain auth state across media pages
- [x] Ensure consistent styling with existing pages
- [x] Integrate with existing mobile responsive patterns
- [x] Test with existing ProtectedRoute guards

#### Error Handling
- [x] Add global error boundary for media routes
- [x] Implement retry logic for failed uploads (via abort controller in UploadModal)
- [x] Add toast notifications for success/error states
- [x] Handle offline scenarios gracefully (via error boundaries and error screens)

### Phase 9: Testing & QA (Days 20-21)

There is a test user you can use for testing:
Username: Tester
Email: test@test.com
Password: TestTest99

#### Functional Testing
- [ ] Test complete upload flow (all file types)
- [ ] Test calendar date highlighting
- [ ] Test navigation between calendar and gallery
- [ ] Test media viewer for images and videos
- [ ] Test download functionality
- [ ] Test delete functionality (admin)
- [ ] Test with multiple files per day
- [ ] Test with empty dates
- [ ] Test with large files (near 500MB limit)

#### Cross-Browser Testing
- [ ] Test on Chrome (desktop & mobile)
- [ ] Test on Firefox
- [ ] Test on Safari (desktop & iOS)
- [ ] Test video playback across browsers
- [ ] Test file upload on different browsers

#### Responsive Testing
- [ ] Test on mobile phones (320px - 480px)
- [ ] Test on tablets (768px - 1024px)
- [ ] Test on desktop (1280px+)
- [ ] Test on ultra-wide displays (1920px+)
- [ ] Verify touch interactions on mobile

#### Performance Testing
- [ ] Test with 100+ media items in a single day
- [ ] Measure page load times
- [ ] Test thumbnail loading performance
- [ ] Test video streaming on slow connections
- [ ] Measure bundle size impact

#### Security Testing
- [ ] Test file upload with invalid MIME types
- [ ] Test file upload with oversized files
- [ ] Attempt to access media without authentication
- [ ] Test XSS prevention in metadata fields
- [ ] Verify file paths are not exposed

### Phase 10: Documentation & Deployment (Day 22)

#### Documentation
- [ ] Document API endpoints in README or Swagger
- [ ] Add JSDoc comments to key functions
- [ ] Create user guide for media upload
- [ ] Document environment variables
- [ ] Document Docker volume configuration

#### Deployment Preparation
- [ ] Create production migration plan

---

## Estimated Timeline

**Total Duration**: ~22 working days (4.5 weeks)

- **Backend Foundation**: 3 days
- **Backend API Implementation**: 3 days
- **Frontend Foundation**: 3 days
- **Calendar Implementation**: 2 days
- **Daily Gallery Implementation**: 3 days
- **Media Viewer Implementation**: 2 days
- **Upload Implementation**: 2 days
- **Navigation & Integration**: 1 day
- **Testing & QA**: 2 days
- **Documentation & Deployment**: 1 day

**Parallel Work Opportunities**:
- Backend and frontend foundation can be developed simultaneously
- Calendar and gallery can be developed in parallel by different developers
- Testing can begin as soon as individual components are complete

---

## Success Criteria

The feature will be considered complete when:

1. ✅ Users can upload images and videos with metadata
2. ✅ Calendar displays all dates with available media
3. ✅ Daily gallery shows all media for a selected date
4. ✅ Media can be viewed in full-screen with proper controls
5. ✅ Videos stream smoothly with playback controls
6. ✅ Images can be zoomed and downloaded
7. ✅ Upload progress is visible and cancellable
8. ✅ All validation (client and server) is working
9. ✅ Mobile experience is smooth and touch-friendly
10. ✅ Media storage persists across container restarts
11. ✅ Docker configuration is environment-agnostic
12. ✅ All security measures are implemented
13. ✅ Performance meets acceptable thresholds
14. ✅ No console errors or warnings in production

---

## Contact & Questions

For questions or clarifications during implementation, refer to:
- Original specification: [MEDIA.md](MEDIA.md)
- Existing codebase patterns in backend/src/ and frontend/src/
- Design mockups (if available)
- Team leads or project maintainers

---

**Last Updated**: 2026-02-22
**Document Version**: 1.0

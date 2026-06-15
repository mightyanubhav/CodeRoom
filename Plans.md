# CodeRoom

## Real-Time Collaborative Technical Interview Platform

### Author

Anubhav Shukla

### Version

1.0

---

# 1. Vision

CodeRoom is a real-time collaborative technical interview platform that enables interviewers and candidates to conduct coding interviews within a single browser tab.

The platform provides:

* Real-time collaborative coding
* Video calling
* Screen sharing
* Sandboxed code execution
* Interview scheduling
* Observer mode
* Anti-cheat monitoring
* Execution snapshots
* Analytics dashboard

The objective is to demonstrate production-grade software engineering concepts commonly used in modern product companies.

---

# 2. High Level Architecture

```text
                     React Frontend
                           |
                           |
                        Nginx
                           |
-----------------------------------------------------
|                                                   |
|                 Oracle Cloud VM                   |
|                                                   |
|  Spring Boot Services                             |
|  Node.js Realtime Server                          |
|  Redis                                            |
|                                                   |
-----------------------------------------------------
            |                         |
            |                         |
      Neon PostgreSQL         Cloudflare R2
```

---

# 3. Tech Stack

## Frontend

* React
* TypeScript
* Vite
* TailwindCSS
* Monaco Editor
* Socket.IO Client
* React Router
* TanStack Query
* Recharts

## Backend

### Spring Boot

Used for:

* Authentication
* Interview Management
* Question Management
* Execution Service

Technologies:

* Spring Boot
* Spring Security
* Spring Data JPA
* PostgreSQL
* JWT

### Node.js

Used for:

* Realtime WebSocket Communication
* WebRTC Signaling

Technologies:

* Express
* Socket.IO
* Redis

---

# 4. Infrastructure

## Oracle Cloud Free Tier

Runs:

* Spring Boot Services
* Node.js Realtime Server
* Redis
* Nginx

## Vercel

Hosts React frontend.

## Neon PostgreSQL

Stores application data.

## Cloudflare R2

Stores:

* Interview recordings
* Documents
* Attachments

---

# 5. Core Features

---

## Feature 1: Authentication

### Capabilities

* Register
* Login
* Refresh Token Rotation
* Google OAuth
* GitHub OAuth

### Technologies

* Spring Security
* JWT
* OAuth2 Client

### Database

Tables:

```sql
users
refresh_tokens
```

---

## Feature 2: Role Based Access Control

Roles:

```text
ADMIN
INTERVIEWER
CANDIDATE
OBSERVER
```

Implementation:

```java
@PreAuthorize(...)
```

---

## Feature 3: Collaborative Editor

### Capabilities

* Monaco Editor
* Real-time code synchronization
* Auto Save

### Technologies

Frontend:

* Monaco Editor
* Socket.IO

Backend:

* Node.js
* Redis Pub/Sub

---

## Feature 4: Operational Transformation

### Purpose

Handles simultaneous edits without corruption.

Example:

```text
User A inserts text
User B deletes text

Server transforms operations
before applying changes.
```

### Components

```java
Operation
InsertOperation
DeleteOperation
TransformEngine
```

---

## Feature 5: Presence System

### Features

* Online Users
* Offline Users
* Typing Indicators
* Cursor Tracking
* Last Seen

### Storage

Redis

```text
presence:{roomId}:{userId}
```

---

## Feature 6: WebRTC Video Calling

### Features

* Audio
* Video
* Camera Toggle
* Mic Toggle

### Technologies

Browser APIs:

```javascript
RTCPeerConnection
MediaDevices
```

Signaling:

```text
Socket.IO
```

Events:

```text
offer
answer
ice-candidate
```

---

## Feature 7: Screen Sharing

### Technologies

```javascript
getDisplayMedia()
```

### Features

* Share Screen
* Share Browser
* Share Window

---

## Feature 8: Chat System

### Features

* Real-time Messaging
* Message History

### Technologies

* Socket.IO
* Redis Pub/Sub
* PostgreSQL

Tables:

```sql
messages
```

---

## Feature 9: Code Execution Engine

### Features

* Run Code
* Sandbox Execution
* Timeout Protection
* Memory Limits

### Technologies

* Spring Boot
* Docker

Supported Languages:

```text
Java
JavaScript
```

Future:

```text
Python
Go
C++
```

---

## Feature 10: Test Case Engine

### Features

* Hidden Test Cases
* Custom Input
* Pass/Fail Results

Tables:

```sql
questions
test_cases
```

---

## Feature 11: Execution Snapshots

### Purpose

Store code state whenever code is executed.

Example:

```text
Attempt #1
Compilation Failed

Attempt #2
3/10 Passed

Attempt #3
10/10 Passed
```

### Database

```sql
execution_attempts
```

Columns:

```text
code
stdout
stderr
status
timestamp
```

---

## Feature 12: Diff Viewer

### Features

Compare:

```text
Attempt #2
vs
Attempt #5
```

Technology:

* Monaco Diff Editor

---

## Feature 13: Interview Scheduling

### Features

* Create Interview
* Schedule Interview
* Generate Invite Link

Tables:

```sql
interviews
```

---

## Feature 14: Observer Mode

### Capabilities

Observer can:

```text
Watch
Listen
View Code
```

Observer cannot:

```text
Edit
Run Code
```

---

## Feature 15: Interview Notes

Private notes for interviewer.

Example:

```text
Communication: Good
Problem Solving: Strong
DSA: Average
```

Table:

```sql
interview_notes
```

---

## Feature 16: Scorecard

Categories:

```text
Communication
Problem Solving
Code Quality
DSA
```

Table:

```sql
scorecards
```

---

## Feature 17: Anti-Cheat System

Track:

* Tab Switching
* Copy Events
* Paste Events
* Window Blur

Browser APIs:

```javascript
visibilitychange
window.blur
copy
paste
```

Table:

```sql
anti_cheat_events
```

---

## Feature 18: Video Recording

### Flow

```text
Interview
   |
MediaRecorder API
   |
Upload
   |
Cloudflare R2
```

### Storage

Cloudflare R2

Folder:

```text
recordings/
```

---

## Feature 19: Analytics Dashboard

Metrics:

* Total Interviews
* Pass Rate
* Average Duration
* Most Used Language
* Execution Success Rate

Technology:

* Recharts
* SQL Aggregations

---

## Feature 20: Notifications

### Events

* Interview Scheduled
* Reminder
* Interview Completed

Technology:

* Resend

---

# 6. Database Design

## Authentication

```sql
users
refresh_tokens
```

## Interview

```sql
interviews
interview_notes
scorecards
```

## Question Bank

```sql
questions
test_cases
```

## Collaboration

```sql
rooms
documents
messages
```

## Execution

```sql
execution_attempts
```

## Monitoring

```sql
anti_cheat_events
```

---

# 7. Redis Usage

## Presence

```text
presence:{roomId}:{userId}
```

## Pub/Sub

```text
room:{roomId}
```

## Rate Limiting

```text
ratelimit:{userId}
```

## Session Cache

```text
session:{sessionId}
```

---

# 8. Deployment

## Frontend

Provider:

Vercel

## Backend

Provider:

Oracle Cloud Free Tier

Containers:

```text
nginx
auth-service
interview-service
execution-service
node-realtime-service
redis
```

## Database

Neon PostgreSQL

## Storage

Cloudflare R2

---

# 9. CI/CD Pipeline

```text
Git Push
   |
GitHub Actions
   |
Run Tests
   |
Build Docker Images
   |
Deploy to Oracle VM
```

---

# 10. Future Enhancements

* Kubernetes Migration
* Kafka Integration
* Multi-language Execution
* AI Interview Feedback
* AI Question Generation
* Collaborative Whiteboard
* Mobile Support

---

# 11. What This Project Demonstrates

* Distributed Systems
* WebSockets
* WebRTC
* Operational Transformation
* Redis Pub/Sub
* Docker Sandboxing
* OAuth2
* JWT Authentication
* Cloud Deployment
* CI/CD
* System Design
* Microservice Architecture

This project is designed to demonstrate engineering skills expected from a Software Development Engineer working in modern product companies.

# ORIN Complete User Guide (Deep Version)

This guide explains each feature deeply: what the section is, how to use it, and how it works from a user perspective.

## 1) App Overview

### What ORIN is
ORIN is a mentorship + career growth + social learning app for:
- Students
- Mentors

### How ORIN works at high level
1. User creates account and logs in.
2. Role decides dashboard and available primary actions.
3. Users discover mentors/domains, connect, chat, post, and track progress.
4. Session booking and payment status drive mentorship flow.

## 2) Entry Flow (Register/Login)

## 2.1 Register

### What you do
- Open `Register`.
- Enter Full Name, Email, Password.
- Choose Role (`Student` or `Mentor`).
- Submit.

### How it works
- Account is created with your selected role.
- Student accounts can usually continue directly.
- Mentor accounts may enter approval state before full mentor access.

### Result
- Successful registration enables login.

## 2.2 Login

### What you do
- Open `Login`.
- Enter email + password.
- Tap login.

### How it works
- App verifies credentials.
- App checks role and approval state.
- App routes you to role-appropriate experience.

### Result
- Student: gets full student flow.
- Mentor:
  - approved: full mentor flow
  - pending: waiting/approval flow

## 3) Navigation System (How Each Navigation Works)

ORIN has two navigation layers.

## 3.1 Bottom Navigation

Tabs:
- `My Profile`
- `Domains`
- `Dashboard`
- `Network`
- `Posts`

### How it works
- Always visible after login (except restricted states).
- One-tap switching between core modules.
- Active tab highlights current page.

### Why this matters
- Fast movement between high-usage sections without opening drawer.

## 3.2 Side Drawer

Drawer has grouped navigation.

### Main group
- Student:
  - Student Home
  - Career Growth
  - My Sessions
  - Network Hub
  - Collaborate
- Mentor:
  - Mentor Home
  - Session Requests
  - Sessions
  - Availability
  - Collaborate

### How Main group works
- These are workflow shortcuts.
- They open specific dashboard sections directly.

### Tools group
- My Profile
- AI Assistant
- Domain Guide
- News & Updates
- Complaints
- Posts
- Messages
- Notifications

### How Tools group works
- Opens utility/secondary modules.
- Used for detailed actions and support flows.

### Settings group
- Settings

### How Settings group works
- App preferences + policy/help entry point.

## 4) Dashboard (Role-Based Deep Working)

## 4.1 Student Dashboard

### Student Dashboard top controls (always visible)
- Header with:
  - Messages shortcut
  - Notifications shortcut
  - Profile picture shortcut (opens My Profile)
- Search bar:
  - searches mentors/dates/sessions
  - shows match count
  - shows matched section names
  - if no match, provides `Ask AI` shortcut with your query
- Hero card:
  - “Unlock Your Mentorship Journey” overview intro

### Student Dashboard primary tabs
Inside Student Dashboard, there are 4 internal tabs:
- `Overview`
- `Career Growth`
- `Sessions`
- `Network`

Each tab has different responsibilities.

### A) Overview tab (what exactly it contains)
1. `Career & Tech Updates`
- Category chips: Tech, EdTech, Govt Exams, Scholarships, Opportunities.
- Horizontal cards with image, title, source, read-more.
- Used for daily market/career awareness.

2. `Featured`
- Quick action cards:
  - Top Mentor Domains
  - Session Conversations
  - AI Career Coach
- These are deep links to important workflows.

3. `Live Banners`
- Rotating info-style horizontal cards.
- Shows policy/support guidance:
  - growth tips
  - payment safety reminders
  - notification usage guidance

### B) Career Growth tab (deep structure)
Career Growth itself has 3 sub-tabs:
- `AI & Planning`
- `Community`
- `Resources`

#### B1) AI & Planning sub-tab
Sections:
1. `AI Mentor Matching`
- Shows recommended mentors with:
  - domain
  - experience
  - rating
  - match score
- Actions:
  - View Profile
  - Book Session

2. `AI Skill Gap Analyzer`
- Shows:
  - target goal
  - current skills
  - missing skills
  - suggested courses

3. `Verified Mentor System`
- Shows quality-trusted mentor cards.
- Includes verified badge + rating signals.

4. `AI Career Roadmap`
- Step-by-step learning plan for your goal.

5. `Internships & Opportunities`
- Opportunity cards with title, org/company, role/type, duration.

6. `College Leaderboard`
- College ranking list and top learners.

7. `Mentor Live Sessions`
- Upcoming live session cards with topic, mentor, start time.

#### B2) Community sub-tab
Sections:
1. `Community Challenges`
- Shows challenge title, domain, participants, deadline.
- Action: `Join Challenge`.

2. `ORIN Certification System`
- Shows earned/available certification levels.

3. `Mentor Groups`
- Group cards with mentor name, member count, schedule.
- Action: `Join Group`.

#### B3) Resources sub-tab
Sections:
1. `AI Project Idea Generator`
- Goal-based project suggestions.

2. `Knowledge Library`
- Resource cards (type + title + description).

3. `ORIN Reputation Score`
- Shows:
  - score
  - level tag
  - top-percent position

4. `AI Resume Builder`
- Shows generated resume preview snippet + file metadata.

### C) Sessions tab (complete behavior)
This tab is your full booking and payment operations center.

1. `Session History & Notes`
- Completed session list
- Add personal session note
- Rate mentor

2. `Pending Payments`
- Shows pending payment sessions with:
  - mentor name
  - date/time
  - amount/currency
  - UPI ID
  - QR image (if configured)
  - payment due time
- Actions:
  - `Upload Screenshot & Submit`
  - `Cancel`

3. `Awaiting Verification`
- Sessions where screenshot submitted and admin review is pending.

4. `Confirmed Sessions`
- Verified payment sessions.
- If mentor posted meeting link, `Join Session` button appears.
- If no link yet, waiting note is shown.

5. `Legacy Booking Requests`
- Older booking-format request list shown for compatibility.

### D) Network tab (inside Student Dashboard)
Contains social + engagement blocks:

1. `Network Activity Feed`
- Shows posts with author, content, and like/comment counts.

2. `Daily Career Dashboard`
- Shows:
  - reputation score
  - tag/level
  - daily tasks (+XP)
  - streak days
  - XP total
  - college/global ranks
- Action: `Complete` task.

3. `People You May Know`
- Suggested users based on platform signals.
- Actions shown: connect/follow intent.

### How student dashboard works as a system
- App fetches profile + sessions + network + growth modules together.
- You move between internal tabs without leaving dashboard.
- Search applies quick discovery across key student items.
- Actions in one area update other areas:
  - booking/payment updates sessions
  - daily tasks affect reputation/leaderboard
  - network activity affects social visibility

### Student daily usage checklist
1. Check `Sessions` for pending actions.
2. Open `Career Growth` for roadmap/gaps/opportunities.
3. Complete tasks in `Network > Daily Career Dashboard`.
4. Review `Overview` news and featured cards.
5. Keep profile and resume blocks updated.

## 4.2 Mentor Dashboard

### Mentor Dashboard sections
- Overview
- Profile & Pricing
- Availability
- Booking Requests
- Sessions
- Admin Chat area
- Reputation/growth cards

### How mentor dashboard works
- Profile and availability define whether students can discover/book effectively.
- Booking requests and sessions are operational control center.
- Reputation/network reflects mentor activity and trust.

### What to do daily
1. Check requests.
2. Confirm availability slots.
3. Keep profile/pricing updated.
4. Manage sessions and communication.

## 5) Domains (Deep Working)

### What Domains does
- Shows domain-based mentor discovery.
- Helps students pick the right category before booking.

### How it works
1. Student selects a domain.
2. App filters and shows available approved mentors.
3. Student opens mentor profile and can proceed to booking/message flow.

### Best use
- Filter by domain first, then compare mentor profile and pricing before booking.

## 6) Domain Guide (Deep Working)

### What Domain Guide does
- Explains domains and sub-domains in learning language.
- Helps students understand choices before action.

### How it works
- Structured cards/sections define domain paths.
- Sub-domain breakdown gives study direction.
- Acts as pre-booking clarity system.

### Best use
- Read relevant domain section first, then go to Domains and choose mentor.

## 7) My Profile (Deep Working)

### What My Profile contains
- Profile photo
- Name + role
- Social counters (posts/followers/following/connections)
- Reputation block
- Lists of followers/following/connections
- Own posts

### How it works
- Profile combines identity + activity + social credibility.
- Counters and lists are tied to network actions.
- Profile data influences discoverability in community flow.

### Key actions
- Edit Profile
- Open Settings
- Open other user profiles from lists/posts

## 8) Resume / Portfolio Features (Deep Working)

## 8.1 Student Resume-like Profile

### Fields
- Headline
- College
- About
- Skills
- Career goals
- Resume URL
- Projects
- Achievements
- Experience
- Profile photo

### How it works
- These details act like a live resume.
- Better detail quality = better mentor matching and profile trust.
- Updated profile improves guidance relevance.

## 8.2 Mentor Professional Profile

### Fields
- Title
- Company
- Experience years
- Session price
- About
- Skills/domain mapping
- LinkedIn/contact fields
- Profile photo

### How it works
- Students evaluate mentor from this data before booking.
- Pricing + profile clarity affects conversion and trust.

## 9) Public Profile (Deep Working)

### What it is
- View of another user’s profile.

### How it works
- Shows profile summary + social stats.
- Shows Follow/Unfollow action.
- Lets you inspect user posts and credibility.

### Typical flow
1. Click user name/photo in feed.
2. Open public profile.
3. Follow/unfollow or connect.
4. Return to feed/dashboard.

## 10) Network Feed (Deep Working)

### What Network does
- Main social stream for community updates.

### Actions
- Create post
- Attach media
- Like
- Comment
- Share
- Follow users from feed

### How it works
- Feed loads public/community posts.
- Each post carries author profile context.
- Engagement updates social graph and post visibility behavior.

### Best use
- Share real learning milestones, project updates, and mentorship progress.

## 11) Posts Screen (Deep Working)

### What it does
- Focused public post browsing module.

### How it works
- Shows feed-style post cards.
- Supports engagement actions and author profile navigation.
- Complements Network with a dedicated posts-focused experience.

## 12) Messages (Deep Working)

### What it does
- Direct communication module.

### How it works
- Loads conversation list.
- Opens selected thread for message exchange.
- Used for session coordination and follow-up.

### Best use
- Keep session-related communication clear and concise.

## 13) Session Booking + Payment (Deep Working)

## 13.1 Student Booking Flow
1. Open mentor profile.
2. Add session intent/note.
3. Book session.
4. Complete payment step (if required).
5. Upload screenshot for manual verification.

## 13.2 Payment statuses
- `pending`
- `waiting_verification`
- `verified`
- `rejected`

### How statuses work
- Pending: user must complete action.
- Waiting verification: submitted; admin decision pending.
- Verified: session confirmation can continue.
- Rejected: user must retry/correct payment submission.

## 13.3 Mentor side session visibility
- Requests/sessions update as workflow changes.
- Confirmed states become operational session actions.

## 14) Availability (Mentor Deep Working)

### What mentor sets
- Weekly slots
- Date-specific slots

### How it works
- Only mentor-defined slots are available to students.
- Slot control reduces conflicts and improves booking quality.

### Best use
- Keep next 7 days updated regularly.

## 15) Notifications (Deep Working)

### What you receive
- Session updates
- Payment workflow updates
- Social notifications (follow/engagement)
- Platform alerts

### How it works
- Notifications reflect actions from sessions, network, and system events.

## 16) News & Updates (Deep Working)

### Categories
- Tech
- EdTech
- Govt Exams
- Scholarships
- Opportunities

### Language support
- English
- Hindi
- Telugu
- Tamil
- Malayalam
- Kannada

### How it works
- User selects category + language.
- App fetches curated cards.
- Cards include image, title, source, read-more link.

### Best use
- Check this daily for opportunities and trend awareness.

## 17) AI Assistant (Deep Working)

### What it helps with
- Domain decision
- Career roadmap guidance
- Skill prioritization
- Mentorship preparation questions

### How it works
- User asks natural-language question.
- Assistant responds with contextual guidance.

### Best use
- Ask specific, goal-based questions for better output.

## 18) Collaborate (Deep Working)

### What it is
- Collaboration proposal form to engage with ORIN team.

### How it works
- User submits details (idea, contact, intent).
- Submission enters admin review flow.

## 19) Complaints (Deep Working)

### What it is
- Structured issue reporting section.

### How it works
- User writes issue details.
- Complaint is stored for admin support handling.

### Best use
- Include exact problem, screen context, and expected behavior.

## 20) Settings + Legal Pages (Deep Working)

Settings gives preference controls and links to:
- Help & Support
- Privacy Policy
- Terms of Use
- Mentor Policy
- About ORIN

### How it works
- Centralized account/system preference zone.
- Legal pages clarify responsibilities and usage conditions.

## 21) Career Features (Deep Working)

Career growth features are spread across dashboard + profile + network.

### 21.1 Daily Career Dashboard
- Daily tasks and completion behavior.
- Helps maintain consistency.

### 21.2 Reputation
- Numeric or tier-like credibility indicator.
- Improves with constructive activity.

### 21.3 Career growth blocks
- Roadmap-style hints
- Suggestion cards
- Progress cues from activity and profile signals

### 21.4 Opportunities visibility
- News/opportunity cards inform users about internships, scholarships, exams, and tech updates.

## 22) Social Features (Deep Working)

### Social graph features
- Follow
- Unfollow
- Followers list
- Following list
- Connections list

### How social works
- Feed interactions and profile actions update relationship state.
- Clicking names/photos opens profile-level actions.

## 23) End-to-End Practical Workflows

## 23.1 Student full journey
1. Register/Login
2. Complete profile (resume details)
3. Learn from Domain Guide
4. Explore Domains
5. Select mentor and book session
6. Upload payment proof
7. Track status in dashboard
8. Chat and continue mentorship
9. Share progress in network/posts
10. Grow reputation over time

## 23.2 Mentor full journey
1. Register/Login
2. Complete profile + pricing
3. Set availability
4. Manage requests
5. Conduct sessions
6. Stay active in network/posts
7. Build trust via profile + reputation + communication

## 24) Best Practices (User Success Checklist)

- Update profile weekly.
- Keep skills/goals clear.
- Use real and valid payment proofs.
- Check notifications daily.
- Keep mentor slots accurate.
- Use AI assistant for planning.
- Keep post quality high (real progress > random content).

## 25) Quick Troubleshooting

- If section keeps loading: refresh and retry on stable network.
- If language news is slow: try English first, then switch language.
- If payment status not changed: check notifications and dashboard status.
- If profile/photo issue: reopen app and retry save/upload.
- If chat not visible: ensure active relationship/session context exists.

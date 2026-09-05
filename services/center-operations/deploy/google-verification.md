# Optional existing-calendar verification

Current status: Thinkfy branding verified and published; OAuth In production. Default
app-created Calendar + selected Drive files require no sensitive scopes. Existing-calendar
access is disabled by the server flag until the `calendar.events` review is approved.

## Scope justification draft

Thinkfy lets tutoring-center administrators connect a chosen existing class calendar and
manage trials and lesson rescheduling from their center workspace. Calendar events are
synchronized with that selected calendar; writes use ETags and operator confirmation.
The default experience uses calendar.app.created. That narrower scope cannot edit events
on a calendar the center created before connecting Thinkfy. calendar.events is requested
only when an administrator explicitly chooses existing-calendar editing;
calendar.calendarlist.readonly supplies calendar choices. Thinkfy binds the selected
calendar to an authorized class and restricts operations by center and class permissions.

## Demonstration to record before submission

Use a test account and synthetic class calendar. Record the existing-calendar option in
an isolated test deployment, the full Google consent flow (including unverified warning),
selection/binding of the synthetic calendar, a confirmed lesson reschedule, the same event
updated in Google, and disconnect. Do not record tokens, passwords, private calendar
contents or real students. Google asks for a YouTube link covering every OAuth client in
this project. Do not substitute a fictional link or claim approval before readback.

After Google approves the scope, enable CENTER_GOOGLE_EXISTING_CALENDARS_ENABLED only
in the intended app environment, deploy, and verify both consent modes. The flag does
not grant Google scopes by itself: the administrator still consents explicitly.

References: [Google audience](https://support.google.com/cloud/answer/15549945),
[verification preparation](https://console.cloud.google.com/auth/verification/submit?project=thinkfy-debatelab-prod).

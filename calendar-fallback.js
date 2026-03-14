/**
 * calendar-fallback.js
 * Static fallback calendar events used when the Google Apps Script API is unavailable.
 * Update this list each academic year to keep the fallback data current.
 * Only include events with date_end >= current school year to avoid empty upcoming lists.
 */
window.CAL_DEMO_EVENTS = [
  { id: 45, date_start: "2026-03-09", date_end: "2026-03-13", title: "Secondary EASE 3", department: "Academic", category: "Assessment" },
  { id: 46, date_start: "2026-03-16", date_end: "2026-03-16", title: "Start of Ramadhan Holiday", department: "Academic", category: "Academic" },
  { id: 47, date_start: "2026-03-20", date_end: "2026-03-21", title: "Hari Raya Idul Fitri 1447 H", department: "Admin/Operations", category: "Public Holiday" },
  { id: 48, date_start: "2026-04-11", date_end: "2026-04-11", title: "Midterm Semester 2 Report Distribution", department: "Academic", category: "Reporting" },
  { id: 49, date_start: "2026-04-18", date_end: "2026-04-18", title: "National Subject Dept Meeting (6)", department: "Academic", category: "Meeting" },
  { id: 50, date_start: "2026-04-20", date_end: "2026-04-24", title: "English Week", department: "Academic", category: "Academic Week" },
  { id: 51, date_start: "2026-04-25", date_end: "2026-04-25", title: "Staff Motivation Day (7)", department: "Admin/Operations", category: "Staff Event" },
  { id: 52, date_start: "2026-05-09", date_end: "2026-05-09", title: "AEASE 2", department: "Academic", category: "Assessment" },
  { id: 53, date_start: "2026-05-16", date_end: "2026-05-16", title: "Staff Motivation Day (8)", department: "Admin/Operations", category: "Staff Event" },
  { id: 54, date_start: "2026-05-18", date_end: "2026-05-22", title: "Secondary EASE 4 & Primary EASE 2", department: "Academic", category: "Assessment" },
  { id: 55, date_start: "2026-05-23", date_end: "2026-05-25", title: "Leadership Camp (2)", department: "Academic", category: "Student Event" },
  { id: 56, date_start: "2026-05-30", date_end: "2026-05-30", title: "Finalterm Semester 2 Report Distribution", department: "Academic", category: "Reporting" },
  { id: 57, date_start: "2026-07-06", date_end: "2026-07-08", title: "New Teacher & Staff Induction / Inset", department: "Admin/Operations", category: "Professional Development" },
  { id: 58, date_start: "2026-07-09", date_end: "2026-07-11", title: "Professional Development (1)", department: "Academic", category: "Professional Development" },
  { id: 59, date_start: "2026-07-13", date_end: "2026-07-15", title: "New Student Induction", department: "Academic", category: "Student Event" },
  { id: 60, date_start: "2026-07-20", date_end: "2026-07-20", title: "Start of Semester 1 (2026-27)", department: "Academic", category: "Academic" },
];

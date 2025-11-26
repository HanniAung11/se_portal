# App.jsx Refactoring Guide

This document outlines the refactoring structure for `App.jsx` to improve organization and maintainability.

## New Directory Structure

```
src/
├── config/
│   └── constants.js          # API_BASE_URL, EMAIL_CONFIG
├── utils/
│   ├── dateUtils.js          # formatDate, formatTime, formatDateDivider, getTodayDate
│   ├── stringUtils.js        # escapeHtml
│   └── timeSlotUtils.js      # parseSlotStartDate, isSlotInFuture, isBookingInPast, generateHourlySlots
├── services/
│   └── emailService.js       # loadEmailJS, sendBookingEmail, sendContactEmail
├── data/
│   ├── roomsData.js          # roomsData object
│   └── coursesData.js        # courses array
├── components/
│   ├── layout/
│   │   ├── Header.jsx
│   │   └── Footer.jsx
│   └── modals/
│       ├── BookingModal.jsx
│       └── CancellationModal.jsx
└── pages/
    ├── AboutPage.jsx
    ├── LoginPage.jsx
    ├── SignupPage.jsx
    ├── BookingPage.jsx
    ├── YourBookingsPage.jsx
    ├── ChatPage.jsx
    ├── CurriculumPage.jsx
    ├── GPAPage.jsx
    ├── CreditsPage.jsx
    └── ContactPage.jsx
```

## Completed Refactoring

✅ Configuration extracted to `config/constants.js`
✅ Utility functions extracted to `utils/` directory
✅ Email services extracted to `services/emailService.js`
✅ Room data extracted to `data/roomsData.js`
✅ Layout components (Header, Footer) - TO BE EXTRACTED
✅ Page components - TO BE EXTRACTED

## Next Steps

1. Extract Header and Footer components
2. Extract all page components to `pages/` directory
3. Extract modal components to `components/modals/`
4. Update App.jsx to import from new structure
5. Update all component imports to use new paths

## Benefits

- **Better Organization**: Related code grouped together
- **Easier Maintenance**: Smaller, focused files
- **Reusability**: Components can be easily reused
- **Testability**: Individual components can be tested in isolation
- **Scalability**: Easy to add new features without bloating files


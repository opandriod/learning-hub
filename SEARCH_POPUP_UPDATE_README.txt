SEARCH POPUP UPDATE

What changed:
1. The sidebar search is now a clean popup modal instead of a dropdown that covers the sidebar menu.
2. The popup works from every protected user layout because it is inside the shared Sidebar component.
3. Supported roles/pages:
   - Student
   - Admin
   - Instructor
   - Sub-admin
4. The search popup can search visible text inside the current page, including:
   - headings
   - cards
   - buttons
   - tables
   - links
   - labels
   - inputs/selects
   - course/progress cards
5. The X button on the left side clears/cancels the current search text.
6. The X button on the top-right closes the popup.
7. Pressing Enter runs search.
8. Multiple matches can be navigated using the Next match button.
9. Related pages are still shown so the user can jump to pages from the popup.

Files updated:
- learning-hub-frontend/src/components/Sidebar.jsx
- learning-hub-frontend/src/App.css

Build check:
- npm install
- npm run build
- Build completed successfully.

BCA Upload Rules Update
=======================

This update changes the sub-admin upload system from a generic "project" upload into a syllabus-aware BCA Resource Upload system.

Based on the Mizoram University BCA syllabus:

Allowed practical/lab uploads:
- Semester 1: PC Applications & Internet Technology Lab, Office Automation Lab
- Semester 2: Programming in C Lab, Tally ERP 9.0 Lab
- Semester 3: Oracle Lab, Data Structure using C Lab
- Semester 4: Web Programming using PHP Lab, C++/Java Programming Lab
- Semester 5: Programming with VB.NET Lab

Allowed project uploads:
- Semester 5: Minor Project
- Semester 6: Major Project

What changed:
1. Removed generic "Any" and "Simple Project" from sub-admin uploads.
2. Added syllabus-based semester/category/subject options.
3. Backend rejects invalid combinations, even if someone changes frontend code.
4. Added project_uploads.subject_name.
5. Updated project store and review pages to display semester, type, and subject.

Run this SQL after the previous marketplace migration:
learning_hub_backend/bca_upload_rules_update.sql

Then restart backend and frontend.

Pricing update:
- Practical/Lab resources are always free.
- Only Semester 5 Minor Project and Semester 6 Major Project uploads can be marked as paid.
- The backend and SQL constraint both enforce this rule, so practical uploads cannot be priced even if someone edits the frontend.

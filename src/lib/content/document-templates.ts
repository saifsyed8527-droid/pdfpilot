export interface DocumentTemplate {
  slug: string;
  name: string;
  category: "work" | "planning" | "records" | "personal";
  description: string;
  purpose: string;
  fields: { key: string; label: string; example: string }[];
  columns: { label: string; weight: number }[];
  rows: number;
  exampleRows: string[][];
  notesLabel: string;
  exampleNotes: string;
  tips: string[];
  question: string;
  answer: string;
}

const field = (key: string, label: string, example: string) => ({ key, label, example });
const cols = (...labels: string[]) => labels.map(label => ({ label, weight: /Description|Topic|Task|Item|Name|Title|Decision|Deliverable|Habit|Plan|Session|Discussion|Goal/.test(label) ? 3 : 2 }));

export const DOCUMENT_CATEGORIES = {
  work: { title: "Work & project PDF templates", description: "Prepare meetings and projects with editable agendas, minutes, briefs and checklists. Each layout has its own fields and a fillable PDF download." },
  planning: { title: "Planner PDF templates", description: "Plan your day, week, study sessions and habits with printable, fillable layouts. Choose A4 or Letter and add your own dates." },
  records: { title: "Log & record PDF templates", description: "Keep attendance, expenses, inventory, contacts and working hours in structured PDF tables. Enter records locally or download a blank form." },
  personal: { title: "Personal PDF templates", description: "Organise trips and reading with practical printable checklists and logs. Personalise the fields before downloading or fill the PDF later." },
} as const;

export const DOCUMENT_TEMPLATES: readonly DocumentTemplate[] = [
  {
    slug: "invoice-template", name: "Invoice", category: "work",
    description: "Create a free fillable PDF invoice with sender, customer, line items and payment notes. Edit online or download a blank A4 or Letter invoice.",
    purpose: "Record the goods or services supplied, the agreed amounts and how the customer can pay. This simple invoice uses manually entered amounts; it does not calculate taxes or totals.",
    fields: [field("invoiceNumber", "Invoice number / date", "INV-001 / 26 September 2026"), field("sender", "From", "Example Studio"), field("billTo", "Bill to", "Example Client")],
    columns: cols("Description", "Quantity", "Rate", "Amount"), rows: 6,
    exampleRows: [["Design consultation", "2 hours", "50.00", "100.00"], ["Document layout", "1", "75.00", "75.00"]],
    notesLabel: "Total, currency, due date and payment instructions", exampleNotes: "Total: USD 175.00. Due: 10 October 2026. Add your agreed payment method.",
    tips: ["Use a unique invoice number so the payment can be matched to the work.", "Enter currency and totals explicitly, and check your arithmetic before sharing.", "Add the business and tax details required for your situation."],
    question: "Does this invoice calculate totals or tax?", answer: "No. Every amount is a text field. Calculate and check the total yourself, then enter it in the payment instructions area. The template is a simple editable layout, not accounting software.",
  },
  {
    slug: "meeting-agenda-template", name: "Meeting agenda", category: "work",
    description: "Make a fillable meeting agenda PDF with time slots, topics and owners. Add the meeting details and objective, then download in A4 or Letter.",
    purpose: "Give participants a clear sequence of topics before the meeting. Time slots and a named owner help everyone prepare the right material.",
    fields: [field("meeting", "Meeting", "Weekly project review"), field("date", "Date and time", "Monday, 10:00 AM"), field("location", "Location or meeting link", "Meeting room 2")],
    columns: cols("Time", "Topic", "Owner"), rows: 8,
    exampleRows: [["10:00", "Review last week's actions", "Alex"], ["10:15", "Decide the next milestone", "Sam"]],
    notesLabel: "Objective and preparation", exampleNotes: "Agree the next milestone. Bring the current task list and open questions.",
    tips: ["Put decisions first and routine updates later.", "Give each topic one owner and a realistic time slot.", "Share the agenda before the meeting so attendees can prepare."],
    question: "Can I turn the agenda into meeting minutes?", answer: "Use this agenda to plan the conversation. After the meeting, use the meeting minutes template to record decisions, owners and due dates; its columns are designed for the outcome rather than the schedule.",
  },
  {
    slug: "meeting-minutes-template", name: "Meeting minutes", category: "work",
    description: "Capture meeting decisions and follow-up actions in a fillable PDF. Add attendees, action owners and due dates, then download the minutes free.",
    purpose: "Keep a concise record of decisions and who will follow through. The action table makes it easy to revisit commitments at the next meeting.",
    fields: [field("meeting", "Meeting", "Website planning"), field("date", "Date", "26 September 2026"), field("attendees", "Attendees", "Alex, Sam, Taylor")],
    columns: cols("Decision / action", "Owner", "Due"), rows: 8,
    exampleRows: [["Review the first draft", "Sam", "30 September"], ["Share the approved page list", "Alex", "28 September"]],
    notesLabel: "Discussion summary and next meeting", exampleNotes: "The team agreed to review one draft before expanding the remaining pages. Next review: Friday.",
    tips: ["Record decisions in clear language instead of transcribing every sentence.", "Give every follow-up action an owner and a due date.", "Circulate the minutes for corrections while the discussion is fresh."],
    question: "Is this a transcript template?", answer: "It is designed for a short discussion summary and an action register. For a full transcript, use a document editor with additional pages. You can keep the transcript alongside these minutes when both are needed.",
  },
  {
    slug: "project-brief-template", name: "Project brief", category: "work",
    description: "Build a one-page project brief PDF with goals, scope, deliverables and success measures. Customise the fields and download a fillable document.",
    purpose: "Define what a project should achieve before detailed planning begins. The brief puts boundaries and measurable outcomes in one document.",
    fields: [field("project", "Project", "Customer welcome guide"), field("owner", "Project owner", "Alex"), field("target", "Target date", "15 October 2026")],
    columns: cols("Area", "Goal / detail"), rows: 6,
    exampleRows: [["Goal", "Help new customers complete their first task"], ["In scope", "Welcome guide and setup checklist"], ["Out of scope", "A complete help-centre rewrite"], ["Success measure", "Customers can follow the checklist independently"]],
    notesLabel: "Dependencies, constraints and open questions", exampleNotes: "Confirm product screenshots and the review owner before drafting.",
    tips: ["State the intended result in one sentence.", "Write down exclusions to prevent ambiguous scope.", "Give success measures an observable outcome."],
    question: "How is a brief different from a project proposal?", answer: "A brief aligns people around goals and scope. A proposal describes suggested deliverables and timing for someone to review. Use the proposal template when presenting a plan for acceptance.",
  },
  {
    slug: "project-proposal-template", name: "Project proposal", category: "work",
    description: "Prepare a simple project proposal PDF with deliverables, dates and scope notes. Edit the proposed work in your browser and download it free.",
    purpose: "Present a concrete sequence of deliverables for review. Use the notes area to state assumptions and what feedback you need before work begins.",
    fields: [field("project", "Proposal / project", "Product handbook"), field("client", "Prepared for", "Example Team"), field("author", "Prepared by / date", "Example Studio / 26 September 2026")],
    columns: cols("Deliverable", "Target date", "Review owner"), rows: 7,
    exampleRows: [["Outline and sample chapter", "3 October", "Team lead"], ["Complete draft", "10 October", "Project owner"]],
    notesLabel: "Scope, assumptions and next steps", exampleNotes: "Includes one review round per deliverable. Please confirm the outline and provide source material before drafting.",
    tips: ["Describe what the recipient will actually receive.", "Make review dates and responsibilities explicit.", "Document assumptions that affect the proposed schedule."],
    question: "Is this a contract?", answer: "This is a planning document for describing proposed work. It does not include contractual terms or signatures. Add any separately agreed terms through your usual process before using it as the basis for an engagement.",
  },
  {
    slug: "project-checklist-template", name: "Project checklist", category: "work",
    description: "Create a printable project checklist PDF with tasks, owners, due dates and completion fields. Fill it online or start with a blank checklist.",
    purpose: "Turn the project scope into a list of actions that can be assigned and checked off. This layout is useful for a launch, handover or recurring delivery.",
    fields: [field("project", "Project", "Website launch"), field("owner", "Coordinator", "Taylor"), field("deadline", "Deadline", "15 October 2026")],
    columns: cols("Task", "Owner", "Due", "Done"), rows: 10,
    exampleRows: [["Check all published links", "Alex", "12 October", ""], ["Review mobile layout", "Sam", "13 October", ""]],
    notesLabel: "Blockers and handover notes", exampleNotes: "Record dependencies here so unfinished tasks have a clear next step.",
    tips: ["Start each task with an action verb.", "Use one owner per task even when several people contribute.", "Mark completion only after checking the expected result."],
    question: "Can I tick completed tasks in the PDF?", answer: "The Done column is an editable text field. Enter X, Yes or a completion date in a PDF reader that supports forms. You can also print the sheet and mark it by hand.",
  },
  {
    slug: "daily-planner-template", name: "Daily planner", category: "planning",
    description: "Plan your day with an editable PDF schedule, priority field and notes. Add time slots and tasks, then download a blank or completed daily planner.",
    purpose: "Allocate time to the most important tasks and leave space for notes. You choose the time intervals, so the schedule can fit working hours or personal plans.",
    fields: [field("date", "Date", "Monday, 28 September"), field("priority", "Main priority", "Complete the first draft")],
    columns: cols("Time", "Task", "Done"), rows: 10,
    exampleRows: [["09:00", "Plan and review messages", ""], ["10:00", "Focus on the first draft", ""], ["13:00", "Review progress", ""]],
    notesLabel: "Notes and tomorrow's follow-up", exampleNotes: "Leave some time between tasks for breaks and unexpected work.",
    tips: ["Choose one main priority before filling every time slot.", "Include breaks and travel time where relevant.", "Move unfinished tasks deliberately rather than duplicating the entire list."],
    question: "Are the times fixed?", answer: "No. Every time field is editable, so you can use half-hour blocks, full hours or an unstructured morning/afternoon schedule. The downloadable blank version has no prefilled appointments.",
  },
  {
    slug: "weekly-planner-template", name: "Weekly planner", category: "planning",
    description: "Make a seven-day weekly planner PDF with editable daily plans and priorities. Choose A4 or Letter and print or fill the PDF on your device.",
    purpose: "See the whole week on one page. Each day has room for a concise plan, while the notes section keeps longer reminders separate.",
    fields: [field("week", "Week beginning", "28 September 2026"), field("priority", "Weekly priority", "Finish the project review")],
    columns: cols("Day", "Plan", "Done"), rows: 7,
    exampleRows: [["Monday", "Plan the week", ""], ["Tuesday", "Draft", ""], ["Wednesday", "Review", ""], ["Thursday", "Revise", ""], ["Friday", "Complete", ""], ["Saturday", "Personal plans", ""], ["Sunday", "Prepare next week", ""]],
    notesLabel: "Reminders and next week", exampleNotes: "Keep one space free for work that needs to move.",
    tips: ["Add fixed appointments before flexible tasks.", "Keep each daily entry short enough to scan quickly.", "Review the following week before carrying unfinished tasks forward."],
    question: "Can the week start on Sunday?", answer: "Yes. The day labels are editable text fields. Change their order before downloading, or download a blank PDF and write your preferred seven-day sequence.",
  },
  {
    slug: "study-planner-template", name: "Study planner", category: "planning",
    description: "Organise study topics, resources and review dates in a fillable PDF planner. Add your subject and deadline, then download or print your plan.",
    purpose: "Break a course or exam syllabus into manageable sessions. Pair each topic with a resource and a planned review date.",
    fields: [field("subject", "Subject / course", "Introduction to statistics"), field("deadline", "Exam or target date", "30 October 2026"), field("goal", "Study goal", "Review one topic each weekday")],
    columns: cols("Topic", "Resource", "Review date", "Done"), rows: 9,
    exampleRows: [["Descriptive statistics", "Chapter 1", "28 September", ""], ["Probability basics", "Lecture notes", "29 September", ""]],
    notesLabel: "Questions to revisit", exampleNotes: "Keep difficult questions here and revisit them in the next review session.",
    tips: ["Use topics small enough to finish in a single session.", "Schedule a review date as well as an initial reading date.", "Track difficult questions instead of just counting pages read."],
    question: "Is this suitable for several subjects?", answer: "You can put a subject name alongside each topic or create one sheet per subject. For several sheets, use Merge PDF to keep the plans in a single document.",
  },
  {
    slug: "habit-tracker-template", name: "Weekly habit tracker", category: "planning",
    description: "Build a weekly habit tracker PDF with seven daily columns and space for eight habits. Edit the habit names, then print or fill the form digitally.",
    purpose: "Record whether you completed a routine each day for one week. Short marks make it easy to see consistency without adding long notes to every cell.",
    fields: [field("week", "Week beginning", "28 September 2026"), field("focus", "Focus", "Make time for everyday routines")],
    columns: [{ label: "Habit", weight: 4 }, ...["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(label => ({ label, weight: 1 }))], rows: 8,
    exampleRows: [["Read 15 minutes", "X", "", "", "", "", "", ""], ["Review tomorrow's plan", "X", "", "", "", "", "", ""]],
    notesLabel: "Weekly reflection", exampleNotes: "Note which routines were easy to maintain and what you want to adjust next week.",
    tips: ["Choose a small set of clearly defined habits.", "Use a consistent mark such as X for completion.", "Review the pattern at the end of the week before adding more habits."],
    question: "Does it automatically calculate streaks?", answer: "No. This is a printable and fillable weekly tracker. You enter completion marks yourself; it does not store a history or calculate streaks across weeks.",
  },
  {
    slug: "attendance-sheet-template", name: "Attendance sheet", category: "records",
    description: "Create a fillable attendance sheet PDF for a meeting, class or workshop. Add the group, date and participant names, then print or download it.",
    purpose: "Record attendance for a single session. The notes column can capture late arrivals or another brief observation relevant to the session.",
    fields: [field("group", "Group / session", "Design workshop"), field("date", "Date", "26 September 2026"), field("lead", "Facilitator", "Alex")],
    columns: cols("Name", "Present", "Notes"), rows: 12,
    exampleRows: [["Participant 1", "Yes", ""], ["Participant 2", "", ""]],
    notesLabel: "Session notes", exampleNotes: "Record any follow-up arrangements for the group.",
    tips: ["Enter the session date before distributing the sheet.", "Use a consistent mark for presence and absence.", "Store completed attendance records according to your group's requirements."],
    question: "Can I use it for more than twelve people?", answer: "Download additional sheets for a larger group. Each sheet has twelve rows, and you can combine the completed PDFs using Merge PDF if you need one file.",
  },
  {
    slug: "expense-log-template", name: "Expense log", category: "records",
    description: "Track dates, descriptions, categories and amounts in a fillable expense log PDF. Add a currency and reporting period, then print or download.",
    purpose: "Keep a simple record of expenses and the supporting receipts you need to retain. Amounts and any totals are entered manually.",
    fields: [field("period", "Period", "September 2026"), field("owner", "Recorded by", "Alex"), field("currency", "Currency", "USD")],
    columns: cols("Date", "Description", "Category", "Amount"), rows: 10,
    exampleRows: [["26 Sep", "Notebook", "Supplies", "5.00"], ["27 Sep", "Train ticket", "Travel", "12.00"]],
    notesLabel: "Total and receipt references", exampleNotes: "Total for the example entries: 17.00. Keep receipt references alongside your records.",
    tips: ["Use the same currency throughout a sheet.", "Record expenses close to the purchase date.", "Check your total against receipts before using it in a report."],
    question: "Does this replace expense or tax software?", answer: "It is a manual record sheet. It does not calculate totals, convert currencies or decide how expenses should be classified for tax purposes.",
  },
  {
    slug: "timesheet-template", name: "Weekly timesheet", category: "records",
    description: "Record daily tasks and working hours in a fillable weekly timesheet PDF. Add the person, week and project, then download a blank or filled sheet.",
    purpose: "Keep a simple record of hours spent on a project during one week. The table leaves the hour format to you, and totals are entered manually.",
    fields: [field("name", "Name", "Alex"), field("week", "Week beginning", "28 September 2026"), field("project", "Project / team", "Documentation")],
    columns: cols("Date", "Task", "Hours"), rows: 7,
    exampleRows: [["Monday", "Drafting", "4.5"], ["Tuesday", "Review", "2.0"]],
    notesLabel: "Total hours and review notes", exampleNotes: "Example total: 6.5 hours. Verify the completed week's entries before sharing.",
    tips: ["Choose decimal hours or hours/minutes and use that format consistently.", "Write enough detail to identify the work later.", "Calculate the weekly total after checking all entries."],
    question: "Will it calculate pay or overtime?", answer: "No. Hours are manual text entries. The template does not calculate pay, overtime or break deductions, and it does not apply employment rules.",
  },
  {
    slug: "inventory-sheet-template", name: "Inventory sheet", category: "records",
    description: "Create a printable inventory sheet PDF with item names, references, quantities and notes. Customise the location and count date in your browser.",
    purpose: "Record an inventory count for a room, shelf or storage location. Item references help distinguish similar objects when you review the count later.",
    fields: [field("location", "Location", "Supply cupboard"), field("date", "Count date", "26 September 2026"), field("owner", "Counted by", "Sam")],
    columns: cols("Item", "Reference", "Quantity", "Notes"), rows: 12,
    exampleRows: [["A4 notebooks", "NB-A4", "12", "Unopened"], ["Blue pens", "PEN-B", "24", ""]],
    notesLabel: "Discrepancies and follow-up", exampleNotes: "Recount any item where the recorded quantity differs from the expected stock.",
    tips: ["Use one sheet per location to keep counts traceable.", "Include an item reference when names alone could be ambiguous.", "Write the unit alongside quantities when counting packs or boxes."],
    question: "Does it update stock automatically?", answer: "No. This template records a manual count. It has no barcode scanner, stock database or automatic adjustments when items are added or removed.",
  },
  {
    slug: "contact-list-template", name: "Contact list", category: "records",
    description: "Make a fillable contact list PDF with names, contact details and notes. Enter information locally and download an A4 or Letter copy for your records.",
    purpose: "Keep a compact contact sheet for a team, club or project. Enter the contact method that is most useful for each person.",
    fields: [field("group", "Team / group", "Project team"), field("updated", "Last updated", "26 September 2026")],
    columns: cols("Name", "Email / phone", "Notes"), rows: 12,
    exampleRows: [["Example contact", "name@example.com", "Project coordinator"]],
    notesLabel: "Contact instructions", exampleNotes: "Record preferred contact times or the purpose of this list.",
    tips: ["Include only the contact information the group needs.", "Add an update date so old copies are easy to identify.", "Review who should receive the completed sheet before sharing."],
    question: "Are the contact details uploaded?", answer: "The generator creates the PDF in your browser. Form values are not sent to PDFPilot analytics or a document server. They remain in the current tab until you leave or clear the form.",
  },
  {
    slug: "packing-checklist-template", name: "Packing checklist", category: "personal",
    description: "Make a printable packing checklist PDF with items, quantities and packed status. Add the trip and dates, then download a personalised or blank list.",
    purpose: "Prepare a trip checklist you can check before leaving. Quantities help when several travellers share one list or when you pack for multiple days.",
    fields: [field("trip", "Trip / destination", "Weekend away"), field("dates", "Travel dates", "2-4 October 2026"), field("traveller", "Traveller", "Alex")],
    columns: cols("Item", "Quantity", "Packed"), rows: 12,
    exampleRows: [["Clothes", "3 sets", ""], ["Phone charger", "1", ""], ["Travel documents", "1 set", ""]],
    notesLabel: "Last-minute reminders", exampleNotes: "Check charging devices and items needed just before departure.",
    tips: ["Group similar items together before printing.", "Include quantities for items you could easily underpack.", "Leave last-minute items in the reminder area."],
    question: "Can I reuse the checklist for another trip?", answer: "Yes. Save a blank fillable copy and update the trip details in a PDF reader. You can also return to the generator and enter a new list; this site does not save your previous entries.",
  },
  {
    slug: "reading-log-template", name: "Reading log", category: "personal",
    description: "Track books, start dates, finish dates and notes with a fillable reading log PDF. Create a personalised A4 or Letter log or download a blank sheet.",
    purpose: "Keep a record of what you read and a brief note you want to remember. Start and finish dates make it easy to review reading over a chosen period.",
    fields: [field("reader", "Reader", "Alex"), field("period", "Period / goal", "Autumn reading")],
    columns: cols("Title / author", "Started", "Finished", "Notes"), rows: 10,
    exampleRows: [["Example book", "1 Sep", "15 Sep", "A useful new perspective"]],
    notesLabel: "Books to read next", exampleNotes: "Add recommendations and library requests here.",
    tips: ["Add the author when several books have similar titles.", "Keep each note short enough to identify your main takeaway.", "Use a new sheet for each month or reading challenge."],
    question: "Does it connect to a reading account?", answer: "No. This is a standalone printable log with editable PDF fields. You add titles and dates yourself, and it does not connect to Goodreads, a library or another account.",
  },
];

export const documentTemplatePath = (row: DocumentTemplate) => `/templates/${row.slug}`;
export const getDocumentTemplate = (slug: string) => DOCUMENT_TEMPLATES.find(row => row.slug === slug);
export function templateExampleValues(row: DocumentTemplate): Record<string, string> {
  return Object.fromEntries([
    ...row.fields.map(f => [f.key, f.example]),
    ...row.exampleRows.flatMap((cells, i) => cells.map((value, j) => [`row-${i}-${j}`, value])),
    ["notes", row.exampleNotes],
  ]);
}

if (new Set(DOCUMENT_TEMPLATES.map(row => row.slug)).size !== DOCUMENT_TEMPLATES.length) throw new Error("Duplicate document template slug");
for (const row of DOCUMENT_TEMPLATES) {
  if (row.rows < 1 || row.rows > 12 || row.exampleRows.length > row.rows || row.exampleRows.some(cells => cells.length !== row.columns.length) || new Set(row.fields.map(f => f.key)).size !== row.fields.length) throw new Error(`Invalid document template: ${row.slug}`);
}

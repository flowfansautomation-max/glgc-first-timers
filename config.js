/* ---- First Timers tracker config ----
   SHEET_ID empty = SAMPLE data. The loader expects a tab "Reports":
     Timestamp | Date | Shepherd | Report | Batch | Value
   Report: Gotten | Called | Visited | Rehearsal | Church
   Batch : the Sunday the people were gotten (every follow-up row names its batch)
   Value : a number. Nothing is ever deleted: old batches simply stop being asked about after week 4. */
window.FT_CONFIG = { SHEET_ID: '', TAB: 'Reports', WEEKS: 4 };

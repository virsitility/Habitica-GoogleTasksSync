// Globals
const scriptProperties = PropertiesService.getScriptProperties();

function main() {
  // Initialize the data
  getGTasks();
  getTodosFromHabitica();

  // Get tasks from GTasks
  let [gtasksCompletedIDs, gtasksIncompleteIDs] = getGTasksId();

  // Get todos from Habitica. This entire list only contains incomplete tasks
  let habiticaTodoAliases = getHabiticaTodoAliases();

  // Copy incomplete tasks from GTasks to Habitica
  //      If the GTask ID is not in the list of Habitica aliases
  //      Add it to Habitica

  let incompleteGTaskIDsToCopy = gtasksIncompleteIDs.filter(x => !habiticaTodoAliases.includes(x));

  for(let t of incompleteGTaskIDsToCopy){
    addGTaskToHabitica(t);
  }

  // Mark all completed tasks as done
  let completeGTaskIDsToMarkAsDone = gtasksCompletedIDs.filter(x => habiticaTodoAliases.includes(x));

  for(let t of completeGTaskIDsToMarkAsDone){
    markGTaskAsDone(t);
  }

  // Update changes in task name, due date, or checklist
  let incompleteGTaskIDsInHabitica = gtasksIncompleteIDs.filter(x => habiticaTodoAliases.includes(x));

  //    Find any mismatch in name, due dates, or checklist and update them
  for (let t of incompleteGTaskIDsInHabitica){
    let habiticaTodo = getHabiticaTodoFromAlias(t);
    let gtask = getGTaskFromId(t);
    let payload = {};
    let needsUpdate = false;

    // Generate the expected payload from the Google Task, which includes cleaned text, priority, and tags
    const expectedHabiticaPayload = gtask.convertToHabiticaPayload();

    // 1. Check for name change
    // The text in expectedHabiticaPayload is already cleaned (H@, @digit, #tag removed)
    if (habiticaTodo.text !== expectedHabiticaPayload.text) {
        payload.text = expectedHabiticaPayload.text;
        needsUpdate = true;
    }

    // 2. Check for difficulty (priority) change
    if (habiticaTodo.priority !== expectedHabiticaPayload.priority) {
        payload.priority = expectedHabiticaPayload.priority;
        needsUpdate = true;
    }

    // 3. Check for tags change
    // HabiticaTodo.tags is an array of {tagName, tagId} objects.
    // expectedHabiticaPayload.tags is an array of tagIds.
    // Need to normalize currentHabiticaTagIds for comparison.
    const currentHabiticaTagIds = habiticaTodo.tags ? habiticaTodo.tags.map(tag => tag.tagId).sort() : [];
    const expectedHabiticaTagIds = expectedHabiticaPayload.tags ? expectedHabiticaPayload.tags.sort() : [];

    if (JSON.stringify(currentHabiticaTagIds) !== JSON.stringify(expectedHabiticaTagIds)) {
        payload.tags = expectedHabiticaTagIds;
        needsUpdate = true;
    }

    // 4. Check for due date change
    const gtaskDueDate = gtask.dueDate ? new Date(gtask.dueDate) : null;
    const habiticaDueDate = habiticaTodo.dueDate ? new Date(habiticaTodo.dueDate) : null;
    if (gtaskDueDate?.valueOf() !== habiticaDueDate?.valueOf()) {
        payload.date = gtask.dueDate; // Send the date string or undefined to remove it
        needsUpdate = true;
    }

    // 5. Check for checklist changes
    const subtasks = getGSubtasksForId(gtask.taskId);
    const newChecklist = subtasks.map(st => ({ text: st.text, completed: st.isCompleted }));
    const oldChecklist = (habiticaTodo.checklist || []).map(item => ({ text: item.text, completed: item.completed })); // Normalize old checklist

    if (JSON.stringify(oldChecklist) !== JSON.stringify(newChecklist)) {
        payload.checklist = newChecklist;
        needsUpdate = true;
    }

    if (needsUpdate) {
        buildRequest("put", "tasks/" + habiticaTodo.id, payload);
    }
  }

}


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

    // Check for name change
    const newHabiticaName = gtask.taskListName + ": " + gtask.text;
    if (habiticaTodo.text !== newHabiticaName) {
        payload.text = newHabiticaName;
        needsUpdate = true;
    }

    // Check for due date change
    const gtaskDueDate = gtask.dueDate ? new Date(gtask.dueDate) : null;
    const habiticaDueDate = habiticaTodo.dueDate ? new Date(habiticaTodo.dueDate) : null;
    if (gtaskDueDate?.valueOf() !== habiticaDueDate?.valueOf()) {
        payload.date = gtask.dueDate; // Send the date string or undefined to remove it
        needsUpdate = true;
    }

    // Check for checklist changes
    const subtasks = getGSubtasksForId(gtask.taskId);
    const newChecklist = subtasks.map(st => ({ text: st.text, completed: st.isCompleted }));
    const oldChecklist = habiticaTodo.checklist.map(item => ({ text: item.text, completed: item.completed })); // Normalize old checklist

    if (JSON.stringify(oldChecklist) !== JSON.stringify(newChecklist)) {
        payload.checklist = newChecklist;
        needsUpdate = true;
    }

    if (needsUpdate) {
        buildRequest("put", "tasks/" + habiticaTodo.id, payload);
    }
  }

}


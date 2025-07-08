const gtasksOptionalArgs = {
    'maxResults': PropertiesService.getScriptProperties().getProperty("gtasks_maxresults"),
    'showHidden':true
};
let gtasksListCompleted = [];
let gtasksListNotCompleted = [];
let gtasksTaskList = [];

class GoogleTask{
  constructor(text, taskId, parentId, taskListId, taskListName, isCompleted, dueDate, notes, listDifficulty){
      this.text = text;
      this.taskId = taskId;
      this.parentId = parentId;
      this.taskListId = taskListId;
      this.taskListName = taskListName;
      this.isCompleted = isCompleted;
      this.dueDate = dueDate;
      this.notes = notes;
      this.listDifficulty = listDifficulty; // Store list difficulty
  }

  convertToHabiticaPayload(){
    let taskText = this.text; // Start with original task text

    // --- 難度設定 ---
    const difficultyMap = {
      '1': 0.1, // Trivial
      '2': 1,   // Easy
      '3': 1.5, // Medium
      '4': 2    // Hard
    };
    let finalDifficulty = this.listDifficulty; // Start with list's default difficulty

    // Check for @<digit> in task name to override difficulty
    const difficultyMatch = taskText.match(/^@(\d)\s*(.*)/);
    if (difficultyMatch) {
      const extractedDifficulty = difficultyMatch[1];
      const remainingText = difficultyMatch[2].trim();
      if (difficultyMap[extractedDifficulty]) {
        finalDifficulty = difficultyMap[extractedDifficulty];
      }
      taskText = remainingText; // Clean task text
    }

    // --- 標籤解析 ---
    const tagsToApply = [];

    // Add list name as a tag
    if (this.taskListName) { 
      let listTagName = this.taskListName;
      let listTagId = getTagIdFromName(listTagName);
      if (listTagId === "") {
        const newTag = createHabiticaTag(listTagName);
        if (newTag) {
          listTagId = newTag.tagId;
        }
      }
      if (listTagId !== "") {
        tagsToApply.push(listTagId);
      }
    }

    const tagRegex = /#(\S+)/g; // Matches # followed by one or more non-whitespace characters
    let match;
    let cleanedTaskText = taskText;

    while ((match = tagRegex.exec(taskText)) !== null) {
      const tagName = match[1]; // Extracted tag name (e.g., "文件", "工作")
      let tagId = getTagIdFromName(tagName);

      if (tagId === "") {
        const newTag = createHabiticaTag(tagName);
        if (newTag) {
          tagId = newTag.tagId;
        }
      }

      if (tagId !== "") {
        tagsToApply.push(tagId);
      }
      // Remove the matched tag from the text for final display
      cleanedTaskText = cleanedTaskText.replace(match[0], '').trim();
    }
    taskText = cleanedTaskText; // Update taskText with cleaned version

    // --- 建立 Payload ---
    var payload = {
      "type" : "todo",
      "text" : this.taskListName + ": " + taskText, // Use cleaned taskText
      "alias" : this.taskId,
      "notes" : this.notes,
      "priority": finalDifficulty // Use determined difficulty
    }

    if (tagsToApply.length > 0){
      payload["tags"] = tagsToApply;
    }

    if (this.parentId === undefined){
      // placeholder 
      // TODO: implement subtasks as checklists
    }

    if (this.dueDate === undefined){
      // pass
    } else {
      payload["date"] = this.dueDate;
    }

    return payload;
  }

}

function getGoogleTaskLists(){
  // Get the ID/Name of the task lists on GTasks
  var taskLists = Tasks.Tasklists.list(gtasksOptionalArgs).getItems();

  if (!taskLists) {
    return [];
  }

  // Define difficulty mapping
  const difficultyMap = {
    '1': 0.1, // Trivial
    '2': 1,   // Easy
    '3': 1.5, // Medium
    '4': 2    // Hard
  };
  const defaultDifficulty = 1.5; // Medium

  return taskLists
    .filter(function(taskList) {
      // Only include lists starting with "H@"
      return taskList.getTitle().startsWith('H@');
    })
    .map(function(taskList) {
      const originalTitle = taskList.getTitle();
      let cleanedName = originalTitle;
      let listDifficulty = defaultDifficulty; // Default to Medium

      // Regex to extract H@<digit> and the rest of the name
      const match = originalTitle.match(/^H@(\d)?(.*)/);
      if (match) {
        const extractedDifficulty = match[1]; // The digit after H@, if any
        const remainingName = match[2].trim(); // The rest of the name

        if (extractedDifficulty && difficultyMap[extractedDifficulty]) {
          listDifficulty = difficultyMap[extractedDifficulty];
        }
        cleanedName = remainingName;
      } else {
        // If it starts with H@ but doesn't match the regex (e.g., just "H@"),
        // still remove H@ and use default difficulty.
        cleanedName = originalTitle.substring(2).trim();
      }

      return {
        id: taskList.getId(),
        name: cleanedName, // Cleaned list name
        listDifficulty: listDifficulty // Parsed difficulty
      };
    });
}

function getGTasksPerList(taskListData){
  // Get all the tasks associated with a task list
  //    argument must be in the format {id: taskListId, name: taskListName, listDifficulty: number}
  //
  // Note: For the purposes of this function, it's ok if the name/ID don't 
  //       match, but the data passed to Habitica will be wrong

  const listID = taskListData.id;
  const listName = taskListData.name;
  const listDifficulty = taskListData.listDifficulty; // Get list difficulty

  var completedTaskList = [];
  var notCompletedTaskList = [];
  var tasks = Tasks.Tasks.list(listID, gtasksOptionalArgs);

  if (tasks.items) {
    for (let t of tasks.items){
      // Skip if task title starts with //
      if (t.title.startsWith('//')) {
        continue;
      }

      // Pass listDifficulty to GoogleTask constructor
      let task = new GoogleTask(t.title, t.id, t.parent, listID, listName, Boolean(t.completed), t.due, t.notes, listDifficulty);

      if (t.title === "Recurring task test"){
        Logger.log("WATCH: " + t.id);
      }

      if (Boolean(t.completed)){
        completedTaskList.push(task);
      } else {
        notCompletedTaskList.push(task);
      }
    }
  }
  
  return [completedTaskList, notCompletedTaskList];
}

function getGTasks(){
  // Just get all of it.
  gtasksTaskList = getGoogleTaskLists();

  var completedList = [];
  var notCompletedList = [];

  for (let l of gtasksTaskList){
    const [comp, ncomp] = getGTasksPerList(l);
    completedList = completedList.concat(comp);
    notCompletedList = notCompletedList.concat(ncomp);
  }

  // return [completedList, notCompletedList];
  gtasksListCompleted = completedList;
  gtasksListNotCompleted = notCompletedList;

  // Segregate main tasks and subtasks
  const allTasks = gtasksListCompleted.concat(gtasksListNotCompleted);
  gtasksMainTasks = allTasks.filter(t => t.parentId === undefined);
  gtasksSubtasks = allTasks.filter(t => t.parentId !== undefined);
}

function getTagNameFromId(tagId){
  for (let t of habiticaTags){
    if (t.tagId === tagId){
      return t.tagName;
    }
  }

  return "";
}

function getTagIdFromName(tagName){
  for (let t of habiticaTags){
    if (t.tagName === tagName){
      return t.tagId;
    }
  }

  return "";
}

function createHabiticaTag(tagName) {
  Logger.log("Creating new Habitica tag: " + tagName);
  const payload = { name: tagName };
  const response = buildRequest("post", "tags", payload);
  const responseCode = response.getResponseCode();

  if (responseCode === 201) { // 201 means 'Created'
    const data = JSON.parse(response.getContentText());
    if (data.success) {
      const newTag = new HabiticaTag(data.data.name, data.data.id);
      habiticaTags.push(newTag); // Add to our global list
      Logger.log("Successfully created tag with ID: " + newTag.tagId);
      return newTag;
    }
  }
  
  Logger.log("Failed to create tag. Response Code: " + responseCode + ", Content: " + response.getContentText());
  return null;
}

function getHabiticaTodoAliases(){
  var aliasList = [];
  for (let t of habiticaTodos){
    if (t.alias === undefined){
      // pass
    } else {
      aliasList.push(t.alias);
    }
  }

  return aliasList;
}

function getHabiticaTodoFromAlias(alias){
  for (let t of habiticaTodos){
    if (t.alias === alias){
      return t;
    }
  }

  return "";
}

function addGTaskToHabitica(gtaskId){
  var gtask = getGTaskFromId(gtaskId);
  var payload = gtask.convertToHabiticaPayload();

  // Add checklist from subtasks
  var subtasks = getGSubtasksForId(gtaskId);
  if (subtasks.length > 0) {
    payload.checklist = subtasks.map(st => ({
      text: st.text,
      completed: st.isCompleted
    }));
  }

  buildRequest("post", "tasks/user", payload);
}

function markGTaskAsDone(gtaskId){
  var habiticaTodo = getHabiticaTodoFromAlias(gtaskId);
  buildRequest("post", "tasks/" + habiticaTodo.id + "/score/up", {"up": "True"});
}

function updateGTaskDueDate(gtask){

}

function deleteAllHabiticaTodos() {
  Logger.log("--- Starting deletion of all Habitica Todos ---");
  // Ensure habiticaTodos is populated
  getTodosFromHabitica();
  if (habiticaTodos.length === 0) {
    Logger.log("No Habitica Todos found to delete.");
    return;
  }
  Logger.log("Found " + habiticaTodos.length + " Habitica Todos to delete.");
  for (let i = 0; i < habiticaTodos.length; i++) {
    const todo = habiticaTodos[i];
    Logger.log("Attempting to delete Todo: \"" + todo.text + "\" (ID: " + todo.id + ")");
    try {
      // Send DELETE request to Habitica API
      const response = buildRequest('delete', 'tasks/' + todo.id);
      const responseCode = response.getResponseCode();
      const responseContent = response.getContentText();
      if (responseCode === 200) {
        Logger.log("Successfully deleted Todo: \"" + todo.text + "\"");
      } else {
        Logger.log("Failed to delete Todo: \"" + todo.text + "\". Response Code: " +
      responseCode + ", Content: " + responseContent);
      }
    } catch (e) {
      Logger.log("Error deleting Todo: \"" + todo.text + "\". Error: " + e.message);
    }
  }
  Logger.log("--- Finished deletion process ---");
}
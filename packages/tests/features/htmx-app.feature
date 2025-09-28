Feature: Todo List Application
  As a user
  I want to manage my todo list
  So that I can track my tasks and their completion status

  Background:
    Given I open the todo application

  Scenario: Viewing the initial todo list
    Then I should see 3 todos in the list
    And I should see "Play with Htmx" with a checkmark
    And I should see "Ship Workerify" with a checkmark
    And I should see "Rewrite Hubpress with Htmx and Workerify" without a checkmark
    And the footer should show "3 items left"

  Scenario: Adding a new todo
    When I type "Buy groceries" in the todo input
    And I press Enter
    Then I should see 4 todos in the list
    And "Buy groceries" should appear at the top of the list
    And "Buy groceries" should not have a checkmark
    And the input field should be empty
    And the footer should show "4 items left"

  Scenario: Marking a todo as completed
    When I click the checkbox for "Rewrite Hubpress with Htmx and Workerify"
    Then "Rewrite Hubpress with Htmx and Workerify" should have a checkmark
    And "Rewrite Hubpress with Htmx and Workerify" should have strikethrough text
    And the footer should still show "3 items left"

  Scenario: Unmarking a completed todo
    When I click the checkbox for "Play with Htmx"
    Then "Play with Htmx" should not have a checkmark
    And "Play with Htmx" should not have strikethrough text
    And the footer should show "3 items left"

  Scenario: Using the Active filter
    When I click on "Active" in the filter menu
    Then I should see only 1 todo in the list
    And I should see "Rewrite Hubpress with Htmx and Workerify"
    And I should not see "Play with Htmx"
    And I should not see "Ship Workerify"
    And the footer should show "1 item left"

  Scenario: Using the Completed filter
    When I click on "Completed" in the filter menu
    Then I should see 2 todos in the list
    And I should see "Play with Htmx" with a checkmark
    And I should see "Ship Workerify" with a checkmark
    And I should not see "Rewrite Hubpress with Htmx and Workerify"
    And the footer should show "2 items left"

  Scenario: Switching back to All filter
    Given I have clicked on "Active" filter
    When I click on "All" in the filter menu
    Then I should see 3 todos in the list
    And I should see all three default todos

  Scenario: Adding and filtering todos
    Given I add a new todo "Test the filters"
    When I click on "Active" in the filter menu
    Then I should see 2 todos in the list
    And I should see "Test the filters" in the list
    And I should see "Rewrite Hubpress with Htmx and Workerify" in the list
    When I click the checkbox for "Test the filters"
    Then I should see only 1 todo in the list
    And I should not see "Test the filters"
    When I click on "Completed" in the filter menu
    Then I should see "Test the filters" with a checkmark

  Scenario: No persistence after page refresh
    Given I add a new todo "This should disappear"
    And I see 4 todos in the list
    When I refresh the page
    Then I should see 3 todos in the list
    And I should not see "This should disappear"
    And I should see the three default todos

  Scenario: Independent state in multiple tabs
    Given I add a new todo "Tab 1 todo" in the current tab
    When I open a new tab with the todo app
    Then the new tab should show 3 todos
    And the new tab should not show "Tab 1 todo"
    When I add "Tab 2 todo" in the new tab
    And I switch back to the first tab
    Then the first tab should still show "Tab 1 todo"
    And the first tab should not show "Tab 2 todo"

  Scenario: Footer count bug with completed todos
    # Note: This documents the current buggy behavior where the count shows all items
    # instead of just active items
    Given the default 3 todos are loaded
    Then the footer should show "3 items left"
    # Even though 2 are completed, it still shows 3
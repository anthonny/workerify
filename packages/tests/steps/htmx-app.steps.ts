import { createBdd } from 'playwright-bdd';
import { expect } from '@playwright/test';
import { test } from './fixtures';

const { Given, When, Then } = createBdd(test);

// Background step
Given('I open the todo application', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  // Wait for the todo list to be loaded via HTMX
  await page.waitForSelector('#todos', { state: 'visible', timeout: 5000 });
});

// Viewing todos
Then('I should see {int} todos in the list', async ({ page }, count: number) => {
  const todoItems = page.locator('#todos .flex.items-start');
  await expect(todoItems).toHaveCount(count);
});

Then('I should see {int} todo in the list', async ({ page }, count: number) => {
  const todoItems = page.locator('#todos .flex.items-start');
  await expect(todoItems).toHaveCount(count);
});

Then('I should see {string} with a checkmark', async ({ page }, todoText: string) => {
  const todo = page.locator('#todos .flex.items-start').filter({ hasText: todoText });
  await expect(todo).toBeVisible();

  // Check for completed state - line-through class
  const textElement = todo.locator('.line-through');
  await expect(textElement).toBeVisible();
});

Then('I should see {string} without a checkmark', async ({ page }, todoText: string) => {
  const todo = page.locator('#todos .flex.items-start').filter({ hasText: todoText });
  await expect(todo).toBeVisible();

  // Check text doesn't have line-through
  const textElement = todo.locator('.ml-4');
  const hasLineThrough = await textElement.evaluate(el =>
    el.classList.contains('line-through')
  );
  expect(hasLineThrough).toBeFalsy();
});

Then('{string} should have a checkmark', async ({ page }, todoText: string) => {
  const todo = page.locator('#todos .flex.items-start').filter({ hasText: todoText });
  const textElement = todo.locator('.line-through');
  await expect(textElement).toBeVisible();
});

Then('{string} should not have a checkmark', async ({ page }, todoText: string) => {
  const todo = page.locator('#todos .flex.items-start').filter({ hasText: todoText });
  const textElement = todo.locator('.ml-4');
  const hasLineThrough = await textElement.evaluate(el =>
    el.classList.contains('line-through')
  );
  expect(hasLineThrough).toBeFalsy();
});

Then('{string} should have strikethrough text', async ({ page }, todoText: string) => {
  const todo = page.locator('#todos .flex.items-start').filter({ hasText: todoText });
  const textElement = todo.locator('.line-through');
  await expect(textElement).toBeVisible();
});

Then('{string} should not have strikethrough text', async ({ page }, todoText: string) => {
  const todo = page.locator('#todos .flex.items-start').filter({ hasText: todoText });
  const textElement = todo.locator('.ml-4');
  const hasLineThrough = await textElement.evaluate(el =>
    el.classList.contains('line-through')
  );
  expect(hasLineThrough).toBeFalsy();
});

Then('the footer should show {string}', async ({ page }, footerText: string) => {
  const footer = page.locator('#footer');
  await expect(footer).toContainText(footerText);
});

Then('the footer should still show {string}', async ({ page }, footerText: string) => {
  const footer = page.locator('#footer');
  await expect(footer).toContainText(footerText);
});

// Adding todos
When('I type {string} in the todo input', async ({ page }, todoText: string) => {
  const input = page.locator('#todo-input');
  await input.fill(todoText);
});

When('I press Enter', async ({ page }) => {
  await page.locator('#todo-input').press('Enter');
  // Wait for HTMX to process the request
  await page.waitForTimeout(500);
});

Then('{string} should appear at the top of the list', async ({ page }, todoText: string) => {
  const firstTodo = page.locator('#todos .flex.items-start').first();
  await expect(firstTodo).toContainText(todoText);
});

Then('the input field should be empty', async ({ page }) => {
  const input = page.locator('#todo-input');
  await expect(input).toHaveValue('');
});

// Toggling todos
When('I click the checkbox for {string}', async ({ page }, todoText: string) => {
  const todo = page.locator('#todos .flex.items-start').filter({ hasText: todoText });
  const checkbox = todo.locator('.text-gray-500.stroke-current.cursor-pointer');
  await checkbox.click();
  // Wait for HTMX to process
  await page.waitForTimeout(500);
});

// Filters
When('I click on {string} in the filter menu', async ({ page }, filterName: string) => {
  const filterButton = page.locator('#footer li').filter({ hasText: filterName });
  await filterButton.click();
  // Wait for HTMX to update the list
  await page.waitForTimeout(500);
});

Given('I have clicked on {string} filter', async ({ page }, filterName: string) => {
  const filterButton = page.locator('#footer li').filter({ hasText: filterName });
  await filterButton.click();
  await page.waitForTimeout(500);
});

Then('I should see only {int} todo in the list', async ({ page }, count: number) => {
  const todos = page.locator('#todos .flex.items-start');
  await expect(todos).toHaveCount(count);
});

Then('I should see {string}', async ({ page }, todoText: string) => {
  const todo = page.locator('#todos .flex.items-start').filter({ hasText: todoText });
  await expect(todo).toBeVisible();
});

Then('I should not see {string}', async ({ page }, todoText: string) => {
  const todo = page.locator('#todos .flex.items-start').filter({ hasText: todoText });
  await expect(todo).toBeHidden();
});

Then('I should see {string} in the list', async ({ page }, todoText: string) => {
  const todo = page.locator('#todos .flex.items-start').filter({ hasText: todoText });
  await expect(todo).toBeVisible();
});

Then('I should see all three default todos', async ({ page }) => {
  await expect(page.locator('#todos .flex.items-start').filter({ hasText: 'Play with Htmx' })).toBeVisible();
  await expect(page.locator('#todos .flex.items-start').filter({ hasText: 'Ship Workerify' })).toBeVisible();
  await expect(page.locator('#todos .flex.items-start').filter({ hasText: 'Rewrite Hubpress with Htmx and Workerify' })).toBeVisible();
});

Then('I should see the three default todos', async ({ page }) => {
  await expect(page.locator('#todos .flex.items-start').filter({ hasText: 'Play with Htmx' })).toBeVisible();
  await expect(page.locator('#todos .flex.items-start').filter({ hasText: 'Ship Workerify' })).toBeVisible();
  await expect(page.locator('#todos .flex.items-start').filter({ hasText: 'Rewrite Hubpress with Htmx and Workerify' })).toBeVisible();
});

// Complex scenarios
Given('I add a new todo {string}', async ({ page }, todoText: string) => {
  const input = page.locator('#todo-input');
  await input.fill(todoText);
  await input.press('Enter');
  await page.waitForTimeout(500);
});

Given('I add a new todo {string} in the current tab', async ({ page }, todoText: string) => {
  const input = page.locator('#todo-input');
  await input.fill(todoText);
  await input.press('Enter');
  await page.waitForTimeout(500);
});

Given('I see {int} todos in the list', async ({ page }, count: number) => {
  const todos = page.locator('#todos .flex.items-start');
  await expect(todos).toHaveCount(count);
});

Given('the default {int} todos are loaded', async ({ page }, count: number) => {
  const todos = page.locator('#todos .flex.items-start');
  await expect(todos).toHaveCount(count);
});

// Page refresh
When('I refresh the page', async ({ page }) => {
  await page.reload();
  await page.waitForLoadState('networkidle');
  await page.waitForSelector('#todos', { state: 'visible', timeout: 5000 });
});

// Multi-tab scenarios
When('I open a new tab with the todo app', async ({ context }) => {
  const newPage = await context.newPage();
  await newPage.goto('/');
  await newPage.waitForLoadState('networkidle');
  await newPage.waitForSelector('#todos', { state: 'visible', timeout: 5000 });
});

Then('the new tab should show {int} todos', async ({ context }) => {
  const pages = context.pages();
  const newTab = pages[pages.length - 1]; // Get the most recently opened tab
  const todos = newTab.locator('#todos .flex.items-start');
  await expect(todos).toHaveCount(3);
});

Then('the new tab should not show {string}', async ({ context }, todoText: string) => {
  const pages = context.pages();
  const newTab = pages[pages.length - 1];
  const todo = newTab.locator('#todos .flex.items-start').filter({ hasText: todoText });
  await expect(todo).toBeHidden();
});

When('I add {string} in the new tab', async ({ context }, todoText: string) => {
  const pages = context.pages();
  const newTab = pages[pages.length - 1];
  const input = newTab.locator('#todo-input');
  await input.fill(todoText);
  await input.press('Enter');
  await newTab.waitForTimeout(500);
});

When('I switch back to the first tab', async ({ context }) => {
  const pages = context.pages();
  await pages[0].bringToFront();
});

Then('the first tab should still show {string}', async ({ context }, todoText: string) => {
  const pages = context.pages();
  const firstTab = pages[0];
  const todo = firstTab.locator('#todos .flex.items-start').filter({ hasText: todoText });
  await expect(todo).toBeVisible();
});

Then('the first tab should not show {string}', async ({ context }, todoText: string) => {
  const pages = context.pages();
  const firstTab = pages[0];
  const todo = firstTab.locator('#todos .flex.items-start').filter({ hasText: todoText });
  await expect(todo).toBeHidden();
});
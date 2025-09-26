# NanoJSX HTMX Template

This template uses NanoJSX for rendering HTML components with JSX syntax.

## Overview

[NanoJSX](https://nanojsx.io/) is a lightweight JSX library for server-side rendering. It provides:

- JSX/TSX syntax support
- Component-based architecture
- Server-side rendering with `renderToString`
- TypeScript support out of the box
- Minimal bundle size

## Structure

- `src/templates/` - Contains JSX components for rendering views
  - `ViewTodo.tsx` - Single todo item component
  - `ViewTodos.tsx` - Todo list container component
  - `ViewFooter.tsx` - Footer component with filters and clear button
- `src/renderer.ts` - Exports the renderer object with render functions
- `src/types.ts` - TypeScript type definitions

## Usage

The renderer uses NanoJSX's `renderToString` function to convert JSX components to HTML strings:

```typescript
import { renderToString } from 'nano-jsx';
import { ViewTodo } from './templates';

const html = renderToString(ViewTodo({ todo, filter }));
```

## Components

Components are written as pure functions that return JSX:

```tsx
export const ViewTodo = ({ todo, filter }: { todo: Todo; filter: Filter }) => {
  return (
    <div id={`todo-${todo.id}`}>
      {todo.value}
    </div>
  );
};
```

## HTMX Integration

HTMX attributes are added directly to JSX elements:

```tsx
<div
  hx-put={`/api/todos/${todo.id}/toggle-status`}
  hx-target={`#todo-${todo.id}`}
  hx-swap="outerHTML"
>
  Toggle
</div>
```
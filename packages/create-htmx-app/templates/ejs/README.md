# Workerify EJS + HTMX Template

A modern web application template using EJS templating, HTMX for dynamic interactions, and Workerify for Service Worker-based routing.

## 🚀 Features

- **EJS Templates**: Server-side templating with pre-compilation for optimal performance
- **HTMX**: Dynamic HTML interactions without writing JavaScript
- **Workerify**: Service Worker-based routing and API handling
- **Vite**: Fast development server with HMR (Hot Module Replacement)
- **Tailwind CSS**: Utility-first CSS framework for rapid UI development
- **TypeScript**: Type-safe development experience

## 📦 Quick Start

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev

# Build for production
pnpm build

# Preview production build
pnpm preview
```

## 📁 Project Structure

```
├── src/
│   ├── templates/          # EJS templates
│   │   ├── viewTodos.ejs   # Main todos list view
│   │   ├── viewTodo.ejs    # Individual todo item template
│   │   ├── viewFooter.ejs  # Footer with filters
│   │   └── index.ts        # Pre-compiled templates (auto-generated)
│   ├── todos.ts            # Todo router with API endpoints
│   ├── main.ts             # Application entry point
│   └── main.css            # Global styles with Tailwind
├── scripts/
│   └── compile-templates.cjs # Template compilation script
├── index.html              # Main HTML file
├── vite.config.ts          # Vite configuration
└── package.json            # Project dependencies and scripts
```

## 🛠️ Available Scripts

### `pnpm dev`
Starts the development server with:
- Vite dev server with HMR
- Automatic EJS template watching and recompilation
- Service Worker registration for local development

### `pnpm build`
Creates a production build with:
- Optimized JavaScript bundles
- Pre-compiled EJS templates
- Minified CSS
- Service Worker for offline functionality

### `pnpm preview`
Preview the production build locally

### `pnpm prebuild`
Manually compile EJS templates (automatically runs on install and during dev)

## 🎨 Working with Templates

### EJS Templates

Templates are located in `src/templates/` and are automatically compiled to JavaScript when:
- Running `pnpm dev` (watches for changes)
- Running `pnpm build`
- After `pnpm install` (postinstall hook)

#### Creating a New Template

1. Create a new `.ejs` file in `src/templates/`
2. Use EJS syntax for templating:

```ejs
<div class="my-component">
  <h2><%= title %></h2>
  <% items.forEach(function(item) { %>
    <p><%= item.name %></p>
  <% }) %>
</div>
```

3. The template will be automatically compiled and available in your TypeScript code

#### Using Templates in TypeScript

```typescript
import { renderTemplate } from './templates';

// Render a template with data
const html = renderTemplate('myTemplate', {
  title: 'Hello',
  items: [{ name: 'Item 1' }]
});
```

#### Including Other Templates

EJS templates can include other templates using the `include` function:

```ejs
<%- include('header', { title: 'Page Title' }) %>
<div class="content">
  <!-- Main content -->
</div>
<%- include('footer') %>
```

The `renderTemplate` function automatically handles includes and passes data correctly.

## 🔧 API Routes with Workerify

Define your API routes in `src/todos.ts` using Workerify's routing system:

```typescript
workerify.get('/api/todos', (request) => {
  // Return rendered EJS template
  return renderTemplate('viewTodos', { todos, filter });
});

workerify.post('/api/todos', (request, reply) => {
  // Handle POST request
  const payload = request.body as TodoPayload;
  // Process and return response
});
```

## 🎯 HTMX Integration

HTMX attributes are used throughout the templates for dynamic interactions:

```ejs
<div hx-get="/api/todos?filter=<%= filter %>"
     hx-trigger="sw-ready, todos:refresh from:body"
     hx-swap="outerHTML">
  <!-- Content -->
</div>
```

### Common HTMX Patterns

- **`hx-get`**: Fetch content from an endpoint
- **`hx-post`**: Submit data to an endpoint
- **`hx-trigger`**: Define when to trigger the request
- **`hx-target`**: Specify where to insert the response
- **`hx-swap`**: Define how to swap the content

## 🔄 Hot Module Replacement (HMR)

The development server supports HMR for:
- CSS changes (instant updates)
- TypeScript/JavaScript files (automatic reload)
- EJS templates (automatic recompilation and reload)

## 🚢 Production Deployment

1. Build the application:
   ```bash
   pnpm build
   ```

2. The `dist/` folder contains all production files:
   - Optimized HTML, CSS, and JavaScript
   - Service Worker for offline functionality
   - All assets properly hashed for caching

3. Deploy the `dist/` folder to your hosting service

## 📚 Learn More

- [EJS Documentation](https://ejs.co/)
- [HTMX Documentation](https://htmx.org/)
- [Workerify Documentation](https://github.com/anthonny/workerify)
- [Vite Documentation](https://vitejs.dev/)
- [Tailwind CSS Documentation](https://tailwindcss.com/)

## 🤝 Contributing

Feel free to submit issues and enhancement requests!

## 📄 License

MIT
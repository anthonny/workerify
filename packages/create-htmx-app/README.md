# @workerify/create-htmx-app

Create modern HTMX applications powered by Workerify's Service Worker-based routing system.

## 🚀 Quick Start

Create a new HTMX app with a single command:

```bash
# Using pnpm
pnpm dlx @workerify/create-htmx-app

# Using npm
npx @workerify/create-htmx-app

# Using yarn
yarn dlx @workerify/create-htmx-app
```

Follow the interactive prompts to:
1. Enter your project name
2. Select a template (currently Nunjucks, with EJS and Handlebars coming soon)

## 📦 What is Workerify?

Workerify is a modern web framework that runs entirely in Service Workers, providing:
- **Zero server runtime** - Your app runs entirely in the browser's Service Worker
- **Offline-first** - Built-in offline support with Service Worker caching
- **Fast routing** - Fastify-like API for defining routes
- **Template rendering** - Server-side rendering patterns in the browser
- **Type-safe** - Full TypeScript support

## 🎨 Available Templates

### Nunjucks Template
A full-featured template with:
- **Nunjucks templating engine** - Powerful templating with inheritance and macros
- **Pre-compiled templates** - Templates are compiled at build time for optimal performance
- **HTMX integration** - Dynamic HTML interactions without writing JavaScript
- **Tailwind CSS** - Utility-first CSS framework
- **Hot reload** - Automatic template recompilation on changes
- **TypeScript** - Type-safe development

**Example structure:**
```
my-app/
├── src/
│   ├── templates/      # Nunjucks templates
│   ├── todos.ts        # API routes
│   └── main.ts         # App entry point
├── index.html
├── vite.config.ts
└── package.json
```

### Coming Soon

#### EJS Template
- Simple and familiar JavaScript templating
- Minimal learning curve
- Perfect for quick prototypes

#### Handlebars Template
- Logic-less templating
- Clean separation of concerns
- Great for larger applications

## 🛠️ Development Workflow

After creating your app:

```bash
# Navigate to your project
cd my-app

# Install dependencies
pnpm install

# Start development server
pnpm dev
```

Your app will be available at `http://localhost:5173` with:
- Hot Module Replacement (HMR)
- Automatic template compilation
- Service Worker development mode

## 📁 Project Structure

Each template creates a project with:

```
my-app/
├── src/
│   ├── templates/       # Template files (.njk, .ejs, .hbs)
│   ├── main.ts          # Application entry point
│   ├── main.css         # Global styles with Tailwind
│   └── [router].ts      # API routes using Workerify
├── public/              # Static assets
├── index.html           # Main HTML file
├── vite.config.ts       # Vite configuration
├── package.json         # Dependencies and scripts
└── README.md            # Project documentation
```

## 🔧 Configuration

### Vite Configuration
All templates use Vite with the `@workerify/vite-plugin` for:
- Service Worker compilation
- Template preprocessing
- Development server
- Production builds

### TypeScript Support
Full TypeScript support with:
- Type-safe routing
- Template type checking
- Auto-completion in IDEs

## 📚 Key Technologies

- **[HTMX](https://htmx.org/)** - High power tools for HTML
- **[Workerify](https://github.com/anthonny/workerify)** - Service Worker framework
- **[Vite](https://vitejs.dev/)** - Next generation frontend tooling
- **[Tailwind CSS](https://tailwindcss.com/)** - Utility-first CSS framework
- **Template Engines**:
  - [Nunjucks](https://mozilla.github.io/nunjucks/) - A rich and powerful templating language
  - [EJS](https://ejs.co/) - Embedded JavaScript templates (coming soon)
  - [Handlebars](https://handlebarsjs.com/) - Minimal templating on steroids (coming soon)

## 🚢 Building for Production

Build your app for production:

```bash
pnpm build
```

This creates an optimized build in the `dist/` folder:
- Minified JavaScript and CSS
- Optimized Service Worker
- Pre-compiled templates
- Asset hashing for caching

Preview the production build:

```bash
pnpm preview
```

## 💡 Examples

### Adding a New Route

```typescript
// src/api.ts
import type { Workerify } from '@workerify/lib';

export default function apiRouter(workerify: Workerify) {
  workerify.get('/api/users', () => {
    return { users: ['Alice', 'Bob'] };
  });

  workerify.post('/api/users', (request) => {
    const user = request.body;
    // Process user...
    return { success: true };
  });
}
```

### Creating a Template (Nunjucks example)

```nunjucks
<!-- src/templates/user.njk -->
<div class="user-card">
  <h2>{{ user.name }}</h2>
  <p>{{ user.email }}</p>
  {% if user.isAdmin %}
    <span class="badge">Admin</span>
  {% endif %}
</div>
```

### Using HTMX

```html
<button hx-post="/api/users"
        hx-target="#user-list"
        hx-swap="beforeend">
  Add User
</button>

<div id="user-list"
     hx-get="/api/users"
     hx-trigger="load">
  <!-- Users will be loaded here -->
</div>
```

## 🤝 Contributing

We welcome contributions! Please see the [main Workerify repository](https://github.com/anthonny/workerify) for contribution guidelines.

## 📄 License

MIT © [Anthonny Quérouil](https://github.com/anthonny)

## 🔗 Links

- [Workerify Documentation](https://github.com/anthonny/workerify)
- [HTMX Documentation](https://htmx.org/)
- [Report Issues](https://github.com/anthonny/workerify/issues)
- [Discord Community](https://discord.gg/workerify) *(coming soon)*

---

<p align="center">
  Built with ❤️ using Workerify
</p>

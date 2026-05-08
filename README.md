# AI Spend Audit

A free web application designed to help startup founders and engineering managers audit their AI tool subscriptions (Cursor, Claude, ChatGPT, etc.). By analyzing team size, primary use cases, and current monthly spend, this tool provides real-world benchmarks and identifies actionable monthly and annual savings.

---

## 🚀 Live Demo & Visuals
> **Status:** 🚧 Active Development (Day 1 of 7)
>
> *Note for Reviewers: The live deployed URL and application screenshots/demo video will be updated here prior to the final submission deadline as per the project timeline.*

---

## 🛠 Quick Start

### Prerequisites
- Node.js 18.x or higher
- npm or yarn

### Installation & Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/ravithakur776/AI-Spend-Audit.git
   cd AI-Spend-Audit
   ```
2. **Install dependencies:**
   ```bash
   npm install
   ```
3. **Run the development server:**
   ```bash
   npm run dev
   ```
4. **Access the application:**
   Open [http://localhost:3000](http://localhost:3000) with your browser to view the interactive spend input form.

## 🏗 Decisions & Trade-offs
Here are 5 key architectural and technical trade-offs made during the development of this MVP:

1. **Next.js App Router vs. Vanilla React (Vite):** Chose Next.js for its built-in API routes and server-side rendering capabilities. While Vite might offer a slightly faster initial dev server setup, Next.js provides a cleaner path for implementing the backend requirements (like lead capture and the Anthropic API integration) within a single repository.

2. **Tailwind CSS vs. Component Libraries (MUI/Chakra):** Opted for pure Tailwind CSS alongside basic headless primitives instead of a heavy pre-built component library. This requires more upfront styling work but ensures complete control over the UI/UX, keeping the bundle size small and the design unique to fit the "entrepreneurial" requirement.

3. **LocalStorage for State Persistence vs. URL Query Params:** For persisting the complex nested array of selected AI tools across page reloads, LocalStorage was chosen over URL parameters. URL params would quickly become bloated and hit length limits with multiple tools and seats, making LocalStorage the cleaner, more scalable choice for the initial input step.

4. **Client-Side Validation vs. Strict Server Validation:** Implemented aggressive client-side validation for the spend input form. While server validation is more secure, client-side validation provides immediate, frictionless feedback to the user, optimizing for conversion and user experience in a free lead-gen tool.

5. **Early CI/CD Setup vs. End-of-Project Configuration:** Decided to implement GitHub Actions for linting and build checks on Day 1 rather than waiting until the project was complete. This enforces strict engineering hygiene from the very first commit, preventing technical debt from accumulating over the 7-day build period.

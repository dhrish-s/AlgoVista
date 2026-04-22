<div align="center">
<img width="1200" height="475" alt="AlgoVista Banner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# 🚀 AlgoVista

**AI-Powered Interactive LeetCode Learning Platform**

AlgoVista is an intelligent, visual-first coding practice platform designed to teach how to think through problems, not just how to solve them. It combines AI-driven reasoning guidance, step-by-step execution visualization, and a flexible problem ingestion system to create a deeply interactive learning experience.

[![React](https://img.shields.io/badge/React-19.0.0-blue.svg)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8.2-blue.svg)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-6.2.0-yellow.svg)](https://vitejs.dev/)
[![Three.js](https://img.shields.io/badge/Three.js-0.184.0-black.svg)](https://threejs.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4.1.14-blue.svg)](https://tailwindcss.com/)

## 🧠 What Makes AlgoVista Different

Most platforms focus on solving problems. **AlgoVista focuses on:**

- Understanding the problem
- Choosing the right approach
- Tracking reasoning quality
- Visualizing how code executes
- Learning from mistakes

It behaves like a **real-time coding tutor + debugger + visualizer**, all in one.

## ✨ Core Features

### 🔹 Dynamic Problem Ingestion
Accepts:
- LeetCode problem number (e.g., 1)
- LeetCode URL
- Full or partial problem text

Automatically parses input into a structured problem format
- Uses AI with confidence scoring and fallback handling
- Requests additional input when parsing is uncertain

### 🔹 AI Reasoning Coach
Evaluates user reasoning before coding
- Provides guided feedback instead of direct answers
- Adapts behavior based on user state:
  - "I don't know" → guided discovery
  - close → targeted hints
  - deviating → correction path
- Encourages structured thinking using a step-by-step reasoning flow

### 🔹 Think-First Enforcement
Code editor remains locked until:
- an approach is selected
- reasoning is provided

Prevents guess-and-check habits
- Encourages interview-style thinking

### 🔹 Thinking Map (Reasoning Path)

Tracks user progress across problem-solving stages:

1. Understand input/output
2. Extract constraints
3. Brute force idea
4. Identify bottleneck
5. Choose pattern
6. Define invariant
7. Plan code
8. Handle edge cases

Provides contextual feedback based on where reasoning breaks down.

### 🔹 Partial Code Visualization (2D)
Visualizes user-written code, not just ideal solutions
- Works even for incomplete code:
  - loops
  - variable updates
  - pointer movement
  - hashmap operations

Clearly shows:
- what changed
- why it changed
- which line caused it

### 🔹 Step-Based Execution Engine
Converts logic into structured execution steps
- Drives synchronized:
  - animations
  - variable updates
  - line highlighting

Avoids fake or misleading visualizations
- Falls back safely when confidence is low

### 🔹 Line-by-Line Code Understanding
Highlights active line during execution
- Shows:
  - current operation
  - variable changes
  - explanation per step

Includes a **Mini Execution Window** for quick context

### 🔹 Interactive Visualization System

Built using 2D rendering (React + Framer Motion + SVG):

Supports:
- Arrays and pointers
- Sliding window
- Hash maps
- Stacks and queues
- Binary search
- Trees and graphs
- Dynamic programming tables
- Recursion call stacks

### 🔹 Movable & Resizable Workspace
Fully customizable layout
- Panels can be:
  - dragged
  - resized
  - collapsed

Prioritizes coding space
- Layout persists across sessions

### 🔹 Multi-LLM AI Architecture
Provider-agnostic AI layer
- Supports:
  - Gemini
  - Claude
  - OpenAI (extensible)

Includes:
- fallback handling
- response normalization
- schema validation

### 🔹 Intelligent Fallback System

Three-level behavior:
1. **Full confidence** → full visualization + guidance
2. **Partial confidence** → AI coach + partial features
3. **Low confidence** → requests more input

Prevents hallucinated explanations or incorrect execution.

### 🔹 Learning Analytics
- Pattern mastery tracking
- Blind spot detection
- Confidence tracking
- Thinking speed analysis
- Weekly skill reports

### 🔹 Practice Optimization
- Spaced repetition (1-day, 3-day, 7-day revisits)
- Problem variation generator
- Edge case challenger

### 🔹 Interview Preparation Mode
- Timed sessions
- Limited hints
- Explanation evaluation
- Performance breakdown

## 🏗️ Architecture Overview

AlgoVista is designed as a modular system:

```
User Input
→ Problem Loader Pipeline
→ Structured Problem
→ AI Reasoning Layer
→ Code Editor
→ Execution Step Generator
→ Visualization Engine
```

### Key Modules
- **ProblemLoaderService**: Parses links, numbers, and raw text into structured problems
- **DynamicStepGenerator**: Generates execution steps based on code and approach
- **AIProviderManager**: Handles multi-LLM routing and fallback
- **CodeOperationMapper**: Converts user code into visualizable operations
- **Visualization Engine**: Renders step-based animations in sync with execution

## 🧪 Error Handling & Reliability
- Schema validation for AI responses
- Safe fallbacks when parsing fails
- Partial visualization for incomplete code
- No silent failures
- UI-based error feedback instead of console-only logs

## 🛠️ Tech Stack
- **Frontend**: React, TypeScript
- **Styling**: Tailwind CSS
- **Animations**: Framer Motion
- **Visualization**: SVG + component-based rendering
- **Editor**: Monaco Editor
- **State Management**: Zustand / Context API
- **AI Integration**: Gemini, Claude, OpenAI (via abstraction layer)

## 🚀 Getting Started

### Prerequisites
- Node.js (version 18 or higher)
- npm or yarn package manager
- Google Gemini API Key (for AI features)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/dhrish-s/AlgoVista.git
   cd AlgoVista
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**

   Create a `.env.local` file in the root directory:
   ```env
   GEMINI_API_KEY=your_gemini_api_key_here
   ```

4. **Start the development server**
   ```bash
   npm run dev
   ```

5. **Open your browser**

   Navigate to `http://localhost:3000` to start using AlgoVista!

## 🎯 Why This Project Matters

AlgoVista is not just a coding tool - **it's a thinking system**.

It demonstrates:
- advanced frontend engineering
- AI system design
- real-time state-driven visualization
- human-centered learning UX
- scalable architecture

## 🚧 Current Focus
- Improving reasoning quality detection
- Enhancing partial-code visualization
- Stabilizing multi-provider AI integration
- Optimizing performance and UX

## 📌 Future Improvements
- Real-time code parsing (AST-based execution)
- Expanded problem coverage
- Collaborative mode
- Personalized learning paths
- Performance benchmarking per user

## 🤝 Contributing

We welcome contributions to AlgoVista!

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes and ensure tests pass
4. Commit your changes: `git commit -m 'Add amazing feature'`
5. Push to the branch: `git push origin feature/amazing-feature`
6. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🧭 Final Thought

**Good engineers don't just write code - they understand why it works.**

This platform is designed to train exactly that.

---

<div align="center">

**Happy Coding! 🎉**

*Transform your algorithm learning journey with AlgoVista*

[🌟 Star this repo](https://github.com/dhrish-s/AlgoVista) if you find it helpful!

</div>

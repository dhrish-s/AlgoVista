# AlgoVista

**AI-assisted algorithm learning workspace**

[![React](https://img.shields.io/badge/React-19-blue.svg)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue.svg)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-6.2-yellow.svg)](https://vite.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4.1-38bdf8.svg)](https://tailwindcss.com/)
[![AI Providers](https://img.shields.io/badge/AI-Gemini%20%7C%20OpenAI%20%7C%20Claude-purple.svg)](#environment)

AlgoVista is an AI-assisted algorithm learning workspace for practicing LeetCode-style problems. It helps users understand a problem, choose an approach, explain their reasoning, write code, and visualize execution step by step.

## Highlights

| Area | What it does |
| --- | --- |
| Problem Input | Loads problems from a LeetCode URL, problem number, or pasted text |
| AI Parsing | Extracts examples, constraints, starter code, and approaches |
| Think First | Keeps the editor locked until reasoning is provided |
| Visualization | Generates ideal-logic or user-code execution traces |
| State View | Shows arrays, hash maps, stacks, queues, highlights, pointers, and variables |
| AI Coach | Gives hints and reasoning feedback without jumping straight to code |
| Progress | Tracks basic streaks, points, and pattern mastery |
| Providers | Supports Gemini, OpenAI, and Claude with fallback routing |

## Tech Stack

![React](https://img.shields.io/badge/Frontend-React-61dafb?style=flat-square)
![TypeScript](https://img.shields.io/badge/Language-TypeScript-3178c6?style=flat-square)
![Vite](https://img.shields.io/badge/Build-Vite-646cff?style=flat-square)
![Tailwind](https://img.shields.io/badge/Styling-Tailwind-38bdf8?style=flat-square)
![Monaco](https://img.shields.io/badge/Editor-Monaco-007acc?style=flat-square)
![Zustand](https://img.shields.io/badge/State-Zustand-ffb86c?style=flat-square)

- Motion for animation
- React Resizable Panels for the workspace layout
- Google Gemini, OpenAI, and Claude provider integrations

## Getting Started

### Prerequisites

- Node.js 18+
- npm
- At least one AI provider API key

### Install

```bash
npm install
```

### Environment

Copy `.env.example` to `.env.local` and add your keys:

```env
VITE_GEMINI_API_KEY="your_gemini_key"
VITE_OPENAI_API_KEY="your_openai_key"
VITE_CLAUDE_API_KEY="your_claude_key"

VITE_AI_PROVIDER="gemini"
VITE_FALLBACK_AI_PROVIDER="gemini"
```

Only one provider key is required to run AI features. Gemini is the default provider.

Note: this Vite build uses client-side provider keys, so keys are exposed in the browser bundle. Use this setup for local demos only; production deployments should proxy AI calls through a backend.

### Run

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

## Scripts

```bash
npm run dev      # Start the Vite dev server
npm run build    # Build for production
npm run preview  # Preview the production build
npm run lint     # Type-check with TypeScript
```

## Project Structure

```text
src/
  components/              UI panels, solver workspace, dashboard, visualizers
  components/visualizer/   Main visualization container
  components/visualizers/  Data structure visualizers
  services/                Problem parsing and execution-step generation
  services/ai/             Provider manager, config, and provider adapters
  store/                   Zustand app state
  lib/                     Shared utilities
  types.ts                 Core app types
```

## Core Flow

```text
Problem input
-> AI parsing
-> Approach selection
-> User reasoning
-> Editor unlock
-> Step generation
-> Visualization and variable inspection
```

## Current Notes

- Execution traces are capped at 50 steps for reliability.
- Low-confidence parsing asks for clearer problem input instead of guessing.
- OpenAI and Claude support parsing, coaching, and step generation; some advanced helper actions are Gemini-first.

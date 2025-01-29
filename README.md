# COGITATIO VIRTUALIS

COGITATIO VIRTUALIS is a considered reimagining of the Curriculum Vitae. Modern language analysis and vector search capabilities are woven into a retro-futurist presentation layer, where Generative AI enhances and compliments user actions, rather than replacing them.

![2024-11-14_01-21-29](https://github.com/user-attachments/assets/7dfdfdbd-a717-4367-9f50-44b305b95e9e)

Professional experience data lives in vector space, accessible through an artificial 'CLI', as well as natural language interactions with an LLM playing the role of a 'smart' terminal operating system.

## OVERVIEW

COGITATIO VIRTUALIS is composed of a full feature vector database and experience document management Python project, and a Next.js/TypeScript, full-stack web application. Highlights include:

- Simulated terminal POST sequence that incorporates live-generated POST sequence operations that mirror random language from the vector database
- User actions that allow direct access to the vector database, the content of which is also passed to the LLM "operating system" in the next pass of the thread
- Finely tuned System Prompts for all major LLM interactions
- Considered separations of types of Experience documents, allowing both user and LLM to better peruse the CV materials
- Programmatic interpretations of Vector data available for users through simple commands (e.g. entering `/exp years` will give a rough estimate of the total number of years of employment CV is aware of)
- ASCII art and kaomoji both pre-generated (with an LLM partner) and live-generated (with an LLM partner)

### VIRTUALIS TERMINAL

A Next.js/TypeScript application that creates an authentic CRT terminal experience, complete with:

- Custom ASCII art rendering
- Retro terminal effects (scanlines, noise, flicker)
- Sophisticated state management
- Rich command interface
- Procedurally generated haikus

### COGITATIO SERVER

A Python-based document processing and vector search system offering:

- Real-time document monitoring
- Vector embeddings generation
- FAISS-powered similarity search
- Professional document analysis
- Structured data exploration
- Sophisticated logging system

## Philosophy

The project embodies several core principles:

1. **Users need Tools with AI, not AI with Tools**

   - Chat-centric applications are great for power users, but programmatic interactions still viable
   - Considered blends of programmatic UI/UX and Artificial Intelligence read better to users than chatbots with `tool_use` calls, even when they can be forced
   - Designer taste is critical when delivering an AI-enhanced application

2. **Meta-Tooling**

   - COGITATIO VIRTUALIS has vector-db access to its own documentation, as it is, itself, a portfolio piece
   - Solves a problem I've always felt with representing myself so briefly and single-mindedly, as one is intended to do on a resume
   - Functioned as a hone for my ability to think about AI applications and systems design

3. **Professional Yet Playful**

   - Sound, stable full-stack architecture
   - Retro-computing aesthetics
   - Technical documentation meets digital spirituality

## Project Status

```
███████╗████████╗ █████╗ ████████╗██╗   ██╗███████╗
██╔════╝╚══██╔══╝██╔══██╗╚══██╔══╝██║   ██║██╔════╝
███████╗   ██║   ███████║   ██║   ██║   ██║███████╗
╚════██║   ██║   ██╔══██║   ██║   ██║   ██║╚════██║
███████║   ██║   ██║  ██║   ██║   ╚██████╔╝███████║
╚══════╝   ╚═╝   ╚═╝  ╚═╝   ╚═╝    ╚═════╝ ╚══════╝
```

### COGITATIO SERVER

- **(✓\_✓)** Vector Store
- **(✓\_✓)** Document Processing
- **(✓\_✓)** API Layer
- **(✓\_✓)** Testing

### VIRTUALIS TERMINAL

- **(✓\_✓)** Boot Sequence
- **(✓\_✓)** Error Handling
- **(✓\_✓)** Main Loop
- **(✓\_✓)** Testing

## Getting Started

### Prerequisites

```bash
Node.js >= 16
Python >= 3.8
```

### Start the Backend

```bash
pip install -e ".[dev]"
python3 -m cogitatio-server.scripts.start_server
```

### Start the Frontend

```bash
cd cogitation-terminal
npm install
npm run dev
```

## Architecture

The system uses a unique architecture that spans both technical and experiential domains:

```
User Input → Terminal Interface → Vector Search → Gen AI → In-Character Response
     ↑          [Technical]         [Data]       [Neural]     [Interpersonal]     
     └──────────────────────── Feedback Loop ────────────────────────┘
```

## Development

For detailed setup and development guidelines, see:

- [COGITATIO README](./cogitatio-server/README.md)
- [VIRTUALIS README](./virtualis-terminal/README.md)

## Future Directions

### Technical Evolution

- Enhanced vector search capabilities
- Advanced document analysis
- Expanded AI interactions
- Performance optimizations

### Experience Enhancement

- More terminal effects
- Extended ASCII art capabilities
- Rich command interfaces
- Interactive visualizations

---

***"Silicon dreams flow through corridors of logic, wisdom awakens."*** -COGITATIO VIRTUALIS Boot Sequence Haiku


# Ghana Food Systems Copilot

A brutally honest agriculture business advisor for Ghana. Tells you the truth about your capital, location, and farming idea — no sugarcoating.

## What It Does

- Takes your capital (in GHS) and location in Ghana
- Tells you if your farming idea is realistic
- Warns you when capital is too small or your location is wrong for the business
- Suggests one alternative if your idea won't work

## Tech Stack

- **Backend**: FastAPI + OpenAI GPT-4o-mini
- **Frontend**: React + Vite + Tailwind CSS
- **AI**: Custom system prompt with Ghana-specific agriculture knowledge

## Setup

### Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate  # Windows
pip install -r requirements.txt
```

Create `.env` in the project root:

```env
OPENAI_API_KEY=sk-your-key-here
OPENAI_MODEL=gpt-4o-mini
```

Run:

```bash
python server.py
```

### Frontend

```bash
cd frontend
bun install
bun dev
```

Open `http://localhost:3000`

## How It Works

The system prompt encodes real Ghana agriculture knowledge:

- **Capital tiers**: Under GHS 5,000 gets you micro-options only. GHS 15,000+ for real poultry. GHS 80,000+ for commercial operations.
- **Location rules**: Accra/East Legon = no livestock, no ponds, no large-scale farming regardless of capital. Eastern Region = poultry friendly. Northern Region = low land cost but weak market access.
- **Tone**: Direct, brief, factual. No "good luck", no encouragement for bad ideas.

## Example Interactions

| User                                              | Bot                                                                                                                                                                   |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| "hi"                                              | "Hello there! How can I help you today?"                                                                                                                              |
| "I have GHS 2,500 and want poultry in East Legon" | "East Legon has no space for poultry and GHS 2,500 is far too small. Try vegetable reselling or container gardening instead."                                         |
| "I have GHS 40,000 in East Legon"                 | "GHS 40,000 does not fix East Legon — no land for farming or ponds there regardless of capital. Move to Eastern Region and it becomes viable for catfish or poultry." |

## Project Structure

```
my_project/
├── backend/
│   ├── server.py          # FastAPI server
│   ├── agri_prompt.py     # System prompt with Ghana agri rules
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   └── App.tsx        # React chat interface
│   ├── package.json
│   └── index.html
├── .env                   # API keys (gitignored)
├── .gitignore
└── README.md
```

## License

MIT

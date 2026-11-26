FROM python:3.15-slim

WORKDIR /app

ENV POETRY_VIRTUALENVS_IN_PROJECT=true

# Install Poetry
RUN pip install --no-cache-dir poetry==2.5.1

# Copy poetry files
COPY pyproject.toml poetry.lock ./

# Install application dependencies in a separate virtual environment
RUN poetry install --no-interaction --no-ansi --no-root

# Copy application code
COPY . .

# Expose port
EXPOSE 8000

# Run the application
CMD ["poetry", "run", "uvicorn", "server.api.main:app", "--reload", "--host", "0.0.0.0", "--port", "8000"]

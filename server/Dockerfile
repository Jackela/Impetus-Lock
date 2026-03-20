FROM python:3.12-slim

WORKDIR /app

# Install Poetry
RUN pip install poetry

# Copy poetry files
COPY pyproject.toml poetry.lock ./

# Configure poetry to not create virtualenv
RUN poetry config virtualenvs.create false

# Install dependencies
RUN poetry install --no-interaction --no-ansi

# Copy application code
COPY . .

# Expose port
EXPOSE 8000

# Run the application
CMD ["poetry", "run", "uvicorn", "server.api.main:app", "--reload", "--host", "0.0.0.0", "--port", "8000"]

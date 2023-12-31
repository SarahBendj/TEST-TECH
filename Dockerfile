FROM node

WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./
# FIX: package.json and package-lock.json copies should be implicit as per security recommendations

# Install dependencies
RUN npm install

# Copy the rest of the application files
COPY . .

# Copy environement vars
COPY .env.example .env

# Expose the port
EXPOSE 3000

# Run the application
CMD ["node", "index.js"]

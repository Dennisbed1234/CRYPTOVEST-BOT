# Use a lightweight Node image
FROM node:18-alpine

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
COPY package*.json ./
RUN npm install --production

# Bundle app source
COPY src ./src
COPY alerts.json ./

ENV NODE_ENV=production

# Expose a common port if your bot listens (optional)
# EXPOSE 3000

CMD ["node", "src/bot.js"]

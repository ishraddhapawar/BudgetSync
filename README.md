# BudgetSync

A Real-Time Collaborative Budget Allocator designed for dynamic financial planning. BudgetSync provides interactive dashboards for both Officers and Stakeholders, facilitating conflict arbitration, real-time budget synchronization, and visually engaging data representations.

## Features

- **Role-Based Access Control**: Secure authentication for Officers and Stakeholders via JWT.
- **Interactive Dashboards**:
  - **Officer Dashboard**: Manage allocations, review proposals, and resolve conflicts.
  - **Stakeholder Dashboard**: Propose budgets and track funding in real-time.
- **Dynamic Data Visualization**: Utilizing Chart.js for intuitive graphical budget analysis.
- **Real-Time Synchronization**: Instant state updates across the platform.
- **Rich User Interface**: Modern aesthetic with fluid p5.js animations, glassmorphism, and responsive design.

## Tech Stack

### Frontend (Client)
- **Framework**: React 18 (Bootstrapped with Vite)
- **Styling**: Vanilla CSS, Lucide React for iconography
- **Visuals/Animations**: Chart.js, p5.js

### Backend (Server)
- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB (via Mongoose)
- **Security**: bcryptjs for hashing, jsonwebtoken for session management
- **Email/Notifications**: Nodemailer

## Getting Started

### Prerequisites

- Node.js (v18+ recommended)
- MongoDB (Local instance or Atlas URI)
- Docker & Docker Compose (Optional, for containerized deployment)

### Local Development Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/ishraddhapawar/AGMRCET.git
   cd AGMRCET/budgetsync
   ```

2. **Backend Setup:**
   Navigate to the server directory, install dependencies, and set up your environment variables.
   ```bash
   cd server
   npm install
   ```
   Create a `.env` file in the `server` directory:
   ```env
   PORT=5000
   MONGO_URI=your_mongodb_connection_string
   JWT_SECRET=your_jwt_secret
   GMAIL_USER=your_email@gmail.com
   GMAIL_PASS=your_app_password
   ```
   Start the server:
   ```bash
   npm run dev
   ```

3. **Frontend Setup:**
   Open a new terminal, navigate to the client directory, and install dependencies.
   ```bash
   cd client
   npm install
   ```
   Start the development server:
   ```bash
   npm run dev
   ```

### Docker Deployment

If you prefer to run the application using Docker, a `docker-compose.yml` file is provided in the `budgetsync` directory.

1. Ensure your `.env` file is properly configured in the `server` directory.
2. From the `budgetsync` directory, run:
   ```bash
   docker-compose up --build
   ```
3. Access the frontend at `http://localhost:5173` and the backend at `http://localhost:5000`.

## License

This project is open-source and available under the MIT License.

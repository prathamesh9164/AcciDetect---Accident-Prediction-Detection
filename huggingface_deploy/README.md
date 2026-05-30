# How to Deploy AcciDetect on Hugging Face Spaces

This guide explains how to deploy your project to **Hugging Face Spaces** using the unified single-container configuration we created.

---

## 🛠️ Step 1: Create a Hugging Face Space

1.  Sign in or sign up at **[huggingface.co](https://huggingface.co/)**.
2.  Click on your profile picture in the top-right corner and select **"New Space"** (or go to [huggingface.co/new-space](https://huggingface.co/new-space)).
3.  Fill in the following details:
    *   **Space Name**: `AcciDetect` (or any name you prefer)
    *   **License**: `mit` (or any license)
    *   **Select the Space SDK**: Click on **Docker**.
    *   **Choose a Docker template**: Select **Blank** (do NOT choose a pre-configured template like Streamlit or Gradio).
    *   **Space Hardware**: Choose the default free tier: **Cpu basic • 2 vCPU • 16 GB RAM • Free** 🆓.
    *   **Visibility**: **Public** (recommended so you can share the link easily).
4.  Click **Create Space**.

---

## 📂 Step 2: Arrange the Project Files

Hugging Face Spaces will automatically build whatever code is pushed to its repository. For it to work, **the Dockerfile and its configuration files must be in the root of your Hugging Face repository**.

You should upload or push the following files/folders to the root of your Hugging Face Space repository:

```text
├── Dockerfile          <-- (Copy from huggingface_deploy/Dockerfile)
├── nginx.conf          <-- (Copy from huggingface_deploy/nginx.conf)
├── start.sh            <-- (Copy from huggingface_deploy/start.sh)
├── backend/            <-- (Your entire Django backend directory)
└── frontend/           <-- (Your entire React frontend directory)
```

> ⚠️ **Important**: In the root directory, make sure you rename the files so they are directly at the root, e.g., the Dockerfile from `huggingface_deploy/Dockerfile` becomes just `Dockerfile` in the root.

---

## 🚀 Step 3: Deploying the Code

You can upload your files to your space in two ways:

### Method A: Through the Hugging Face Web Interface (Easiest for small changes)
1. Go to your created Space page, click the **"Files and versions"** tab.
2. Click **"Add file"** -> **"Upload files"**.
3. Drag and drop your `backend` folder, `frontend` folder, and the three configuration files (`Dockerfile`, `nginx.conf`, `start.sh`) into the upload box.
4. Add a commit message (e.g. `Initial Hugging Face deploy`) and click **Commit changes to main**.

---

### Method B: Using Git CLI (Recommended & Professional)
Hugging Face Spaces act as standard Git repositories. You can add your space as a Git remote and push directly to it.

1.  Install the Git LFS (Large File Storage) if you haven't already (needed for large files like `yolov8n.pt` weight files):
    ```bash
    git lfs install
    ```
2.  Clone your Hugging Face Space to a temporary folder:
    ```bash
    git clone https://huggingface.co/spaces/YOUR_USERNAME/YOUR_SPACE_NAME
    ```
3.  Copy the `backend` and `frontend` folders, along with the contents of the `huggingface_deploy` folder (`Dockerfile`, `nginx.conf`, `start.sh`), into this cloned repository directory.
4.  Commit and push:
    ```bash
    git add .
    git commit -m "Deploy AcciDetect to Hugging Face"
    git push
    ```

---

## ⚙️ Step 4: Add Environment Variables (Optional)
If you want to enable the Twilio SMS and SMTP Email alerts:
1.  Go to your Space page.
2.  Click the **Settings** tab.
3.  Scroll down to the **Variables and Secrets** section.
4.  Add your keys here as **Secrets** (so they remain hidden):
    *   `EMAIL_HOST` = `smtp.gmail.com`
    *   `EMAIL_PORT` = `587`
    *   `EMAIL_USE_TLS` = `True`
    *   `EMAIL_HOST_USER` = `your_email@gmail.com`
    *   `EMAIL_HOST_PASSWORD` = `your_gmail_app_password`
    *   `DEFAULT_FROM_EMAIL` = `your_email@gmail.com`
    *   `ALERT_EMAIL` = `where_to_send_alerts@example.com`
    *   `TWILIO_ACCOUNT_SID` = `your_twilio_sid`
    *   `TWILIO_AUTH_TOKEN` = `your_twilio_token`
    *   `TWILIO_FROM_NUMBER` = `your_twilio_phone`
    *   `TWILIO_TO_NUMBER` = `your_alert_phone`

---

## 🎉 Step 5: Testing Your App
Hugging Face will automatically detect the `Dockerfile` and begin building your container.
*   You can watch the build logs under the **"App"** or **"Logs"** tab.
*   Once the build completes (it will take a few minutes to build the React application and download PyTorch), you will see the status change from **Building** ➡️ **Running**.
*   Your AcciDetect app is now fully functional, running in the cloud, and accessible under the URL:
    `https://huggingface.co/spaces/YOUR_USERNAME/YOUR_SPACE_NAME`

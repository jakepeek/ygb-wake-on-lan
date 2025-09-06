# YGB Wake-on-LAN Manager

This service runs on a Raspberry Pi and automatically wakes up bay PCs based on bookings in Your Golf Booking (YGB). It polls the YGB API for bay data and bookings, calculates which bays should be active, and sends Wake-on-LAN (WOL) packets to ensure the correct machines are awake.

### Important Note!

This service does not power off bays - partly because this is a nightmare on windows to automate, and partly because it's not needed. I recommend you add power settings on the PC to have it auto-sleep after a period of inactivity, and auto shut-down at the end of the day. 

This is the best balance of power draw and speed of booting.

## 🚀 Features

- Fetches bay definitions and bookings from the YGB API  
- Sends WOL packets to bays that should be active  
- Re-sends WOL packets on every interval to ensure no wake packet is missed  
- Configurable pre-booking and post-booking wake times  
- Daemonised with PM2 for auto-start and resilience  

---

## 🛠️ Requirements

- Raspberry Pi (4 or newer recommended)  
- Node.js (20.x LTS recommended)  
- npm  
- PM2 (for running as a service)  
- Access to Your Golf Booking API with an API key  

---

## ⚙️ Setup
Follow the steps below after setting up your Raspberry Pi and connecting to it via SSH.

### 1. Clone the repo
```bash
git clone https://github.com/jakepeek/ygb-wake-on-lan.git
cd ygb-wake-on-lan
```

### 2. Install Node.js (via NodeSource)
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

### 3. Install dependencies
```bash
npm install
```

### 4. Configure environment
Copy `example.env` to `.env` and edit values:
```bash
cp example.env .env
nano .env
```

Key variables:
- `API_KEY` → Your YGB API key  
- `API_ROOT` → The API base URL for your venue  
- `PRE_BOOKING_MINUTES` → Minutes before booking start to wake a bay  
- `POST_BOOKING_MINUTES` → Minutes after booking end to keep bay awake  
- `BAY_FETCH_INTERVAL_MINUTES` → How often to refresh bay definitions  
- `BOOKING_FETCH_INTERVAL_MINUTES` → How often to poll bookings  

### 5. Create `bayData.json`
This file maps your bay references (from YGB) to their physical MAC addresses for WOL.  

Example:
```json
[
  {
    "ref": "B1",
    "mac": "D8:5E:D3:A6:B8:CE"
  },
  {
    "ref": "B2",
    "mac": "D8:5E:D3:A6:B8:98"
  }
]
```

- `ref` → Bay reference string as it appears in YGB  
- `mac` → The MAC address of the bay PC (uppercase, `:` separated)  

Each bay you want controlled must appear in this file.

### 6. Test run
```bash
npm run start
```

You should see logs for:
- Bay mapping data  
- Fetched bookings  
- Bay states and WOL attempts  

---

## 🔄 Running as a service with PM2

Install PM2 globally:
```bash
sudo npm install -g pm2
```

Start the app:
```bash
pm2 start index.js --name ygb-wol
```

Save the process list so it restarts after reboot:
```bash
pm2 save
```

Enable PM2 startup on boot:
```bash
pm2 startup
# follow the on-screen instructions (copy/paste the command it prints)
```

Useful commands:
```bash
pm2 ls              # list managed processes
pm2 logs ygb-wol    # view logs
pm2 restart ygb-wol # restart the process
pm2 stop ygb-wol    # stop the process
pm2 delete ygb-wol  # remove from pm2
```

---

## ✅ Summary

1. Install Node + npm + PM2 on your Pi  
2. Clone repo and `npm install`  
3. Configure `.env` and `bayData.json`  
4. Run with PM2 for resilience  

Once configured, the Pi will automatically wake the correct bay PCs before bookings, keep them active during, and allow them to sleep when idle.

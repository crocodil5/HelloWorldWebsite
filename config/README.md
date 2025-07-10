# Configuration Files

## admins.json

This file contains the list of Telegram user IDs who have administrator privileges in the bot.

### Format:
```json
{
  "admins": [
    "6672241595",
    "another_user_id"
  ]
}
```

### Adding New Admins:
1. Get the Telegram user ID of the person you want to make admin
2. Add their ID to the `admins` array in `admins.json`
3. Restart the application for changes to take effect

### Current Admins:
- `8146147595` - @Dalsend (admin)
- `6672241595` - crocswork (admin)

### Admin Privileges:
- Send broadcast messages to all users
- Manage bot settings (enable/disable)
- Delete all links
- Access admin-only commands
- Redirect users between pages
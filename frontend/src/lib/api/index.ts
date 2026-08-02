import { ApiClient } from './core';
import { installAuth } from './auth';
import { installUsers } from './users';
import { installChats } from './chats';
import { installMessages } from './messages';
import { installSocial } from './social';
import { installAI } from './ai';
import { installFeatures } from './features';
import { installRealtime } from './realtime';
import { installBots } from './bots';

const api = new ApiClient();

// Install all domain methods onto the singleton
installAuth(api);
installUsers(api);
installChats(api);
installMessages(api);
installSocial(api);
installAI(api);
installFeatures(api);
installRealtime(api);
installBots(api);

export { api };
export default api;


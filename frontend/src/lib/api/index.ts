import { ApiClient } from './core';
import { installAuth } from './auth';
import { installUsers } from './users';
import { installChats } from './chats';
import { installMessages } from './messages';
import { installUpload } from './upload';
import { installSocial } from './social';
import { installAI } from './ai';
import { installFeatures } from './features';
import { installRealtime } from './realtime';
import { installBots } from './bots';
import { installUserStickers } from './userStickers';
import { installStories } from './stories';
import { installAdmin } from './admin';
import { installInviteLinks } from './inviteLinks';
import { installDnd } from './dnd';
import { installBackup } from './backup';

const api = new ApiClient();

// Install all domain methods onto the singleton
installAuth(api);
installUsers(api);
installChats(api);
installMessages(api);
installUpload(api);
installSocial(api);
installAI(api);
installFeatures(api);
installRealtime(api);
installBots(api);
installUserStickers(api);
installStories(api);
installAdmin(api);
installInviteLinks(api);
installDnd(api);
installBackup(api);

export { api };
export default api;
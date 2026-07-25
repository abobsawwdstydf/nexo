export interface Attachment {
  file: File;
  preview?: string;
  type: 'image' | 'video' | 'file' | 'audio';
}

export interface MessageInputProps {
  chatId: string;
}

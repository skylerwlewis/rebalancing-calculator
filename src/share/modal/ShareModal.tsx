import { useContext, useMemo, useRef, useState } from 'react';
import { Button, Modal, TextField, Typography } from '@mui/material';
import ModalProps from './ModalProps';
import ModalBox from './ModalBox';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { InputUrlParamContext } from '../InputUrlParamContext';
import { UrlParamInputContext } from '../UrlParamInputContext';

const ShareModal = ({
  open,
  handleClose
}: ModalProps) => {

  const { baseUrl, queryStrings } = useContext(UrlParamInputContext);
  const { inputUrlJsonString } = useContext(InputUrlParamContext);

  const linkUrl = useMemo(() => encodeURI(baseUrl + '?' + queryStrings + 'input=' + inputUrlJsonString), [baseUrl, queryStrings, inputUrlJsonString]);

  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'failed'>('idle');
  const inputRef = useRef<HTMLInputElement>(null);

  const copyLink = async () => {
    try {
      // Throws when the Clipboard API is unavailable (insecure context) and rejects when permission is denied.
      await navigator.clipboard.writeText(linkUrl);
      setCopyStatus('copied');
    } catch {
      // Select the link so the user can copy it manually.
      inputRef.current?.focus();
      inputRef.current?.select();
      setCopyStatus('failed');
    }
  };

  const onClose = () => {
    setCopyStatus('idle');
    handleClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      aria-labelledby='ss-modal-modal-title'
      aria-describedby='ss-modal-modal-description'
    >
      <ModalBox>
        <Typography id='ss-modal-modal-title' variant='h4' component='h2' gutterBottom>
          Share or Bookmark Your Results
        </Typography>
        <Typography id='ss-modal-modal-title' variant='h6' component='h2'>
          URL to share
        </Typography>
        <TextField
          style={{ width: '100%' }}
          value={linkUrl}
          inputRef={inputRef}
          error={copyStatus === 'failed'}
          helperText={
            copyStatus === 'copied'
              ? 'Link copied to clipboard.'
              : copyStatus === 'failed'
                ? "Couldn't copy automatically. The link is selected; press Ctrl+C (⌘C on Mac) to copy it."
                : undefined
          }
          InputProps={{
            readOnly: true,
            endAdornment: <Button aria-label='Copy link' onClick={() => { void copyLink(); }}><ContentCopyIcon /></Button>
          }}
        />
      </ModalBox>
    </Modal>
  );
};

export default ShareModal;
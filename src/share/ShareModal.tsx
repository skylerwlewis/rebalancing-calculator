import { useContext, useMemo } from 'react';
import { Button, Modal, TextField, Typography } from '@mui/material';
import ModalProps from '../ModalProps';
import ModalBox from '../ModalBox';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { InputUrlParamContext } from './InputUrlParamProvider';
import { UrlParamInputContext } from './UrlParamInputProvider';

const ShareModal = ({
  open,
  handleClose
}: ModalProps) => {

  const { baseUrl, queryStrings } = useContext(UrlParamInputContext);
  const { inputUrlJsonString } = useContext(InputUrlParamContext);

  const linkUrl = useMemo(() => encodeURI(baseUrl + '?' + queryStrings + 'input=' + inputUrlJsonString), [baseUrl, queryStrings, inputUrlJsonString]);

  const copyTextToClipboard = (text: string) => navigator.clipboard.writeText(text);

  return (
    <Modal
      open={open}
      onClose={handleClose}
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
          disabled={true}
          value={linkUrl}
          InputProps={{
            endAdornment: <Button onClick={() => copyTextToClipboard(linkUrl)}><ContentCopyIcon /></Button>
          }}
        />
      </ModalBox>
    </Modal>
  );
};

export default ShareModal;
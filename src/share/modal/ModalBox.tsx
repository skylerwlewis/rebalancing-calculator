import { Box, BoxProps } from '@mui/material';
import React from 'react';

const modalBoxSx = {
  position: 'absolute' as const,
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  bgcolor: 'background.paper',
  border: '2px solid #000',
  boxShadow: 24,
  p: 4,
  minWidth: '400px'
};

const ModalBox = React.forwardRef((props: BoxProps, ref) => <Box {...props} ref={ref} sx={modalBoxSx} />);
ModalBox.displayName = 'ModalBox';

export default ModalBox;
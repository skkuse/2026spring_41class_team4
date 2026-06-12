"use client";

import React from 'react';
import { useAuth } from '../../../hooks/useAuth';
import { GoogleLogin } from '@react-oauth/google';
import { useToast } from '../../../contexts/ToastContext';

export function SocialLoginGroup() {
  const { loginWithGoogle } = useAuth();
  const { showToast } = useToast();

  return (
    <div className="w-full flex justify-center mt-4">
      <GoogleLogin
        onSuccess={async (credentialResponse) => {
          if (credentialResponse.credential) {
            await loginWithGoogle(credentialResponse.credential);
          }
        }}
        onError={() => {
          showToast('구글 로그인에 실패했습니다.', 'error');
        }}
        useOneTap
      />
    </div>
  );
}

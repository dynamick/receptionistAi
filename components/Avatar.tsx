
import React, { useRef, useEffect, useState, useMemo } from 'react';
import { useFrame, ThreeElements } from '@react-three/fiber';
import { useGLTF, useAnimations, useFBX } from '@react-three/drei';
import { AVATAR, ANIMATION_URLS } from '../constants';
import * as THREE from 'three';

declare global {
  namespace JSX {
    interface IntrinsicElements extends ThreeElements {}
  }
}

interface AvatarProps {
  modelUrl: string;
  isSpeaking: boolean;
  isRumbaCommanded: boolean;
  isJumpCommanded: boolean;
  isAngryCommanded: boolean;
  isGreetingCommanded: boolean;
  isHipHopCommanded: boolean;
  isKissCommanded: boolean;
  isLookAroundCommanded: boolean;
  isPointingCommanded: boolean;
  audioAmplitude: number;
}

export const Avatar: React.FC<AvatarProps> = ({ 
  modelUrl, 
  isSpeaking, 
  isRumbaCommanded, 
  isJumpCommanded, 
  isAngryCommanded,
  isGreetingCommanded,
  isHipHopCommanded,
  isKissCommanded,
  isLookAroundCommanded,
  isPointingCommanded,
  audioAmplitude 
}) => {
  const group = useRef<THREE.Group>(null);
  const [isRandomDancing, setIsRandomDancing] = useState(false);
  
  const { scene, animations: gltfAnimations } = useGLTF(modelUrl);
  
  // Base animations
  const talkFbx = useFBX(ANIMATION_URLS.talking);
  const idleRumbaFbx = useFBX(ANIMATION_URLS.rumba);
  const idleStandingFbx = useFBX(ANIMATION_URLS.idle);
  const jumpFbx = useFBX(ANIMATION_URLS.jump);
  
  // New animations
  const angryFbx = useFBX(ANIMATION_URLS.angry);
  const greetingFbx = useFBX(ANIMATION_URLS.greeting);
  const hipHopFbx = useFBX(ANIMATION_URLS.hipHop);
  const kissFbx = useFBX(ANIMATION_URLS.kiss);
  const lookAroundFbx = useFBX(ANIMATION_URLS.lookAround);
  const pointingFbx = useFBX(ANIMATION_URLS.pointing);

  const allAnimations = useMemo(() => {
    const clips: THREE.AnimationClip[] = [...gltfAnimations];
    const processFbx = (fbx: THREE.Group, prefix: string) => {
      if (!fbx) return;
      fbx.animations.forEach((clip, index) => {
        const newClip = clip.clone();
        newClip.name = `${prefix}_${index}`;
        newClip.tracks.forEach((track) => {
          track.name = track.name.replace(/mixamorig|MixamoRig/g, '');
        });
        clips.push(newClip);
      });
    };
    
    processFbx(idleRumbaFbx, 'fbx_idle_rumba');
    processFbx(idleStandingFbx, 'fbx_idle_standing');
    processFbx(talkFbx, 'fbx_talk');
    processFbx(jumpFbx, 'fbx_jump');
    processFbx(angryFbx, 'fbx_angry');
    processFbx(greetingFbx, 'fbx_greeting');
    processFbx(hipHopFbx, 'fbx_hip_hop');
    processFbx(kissFbx, 'fbx_kiss');
    processFbx(lookAroundFbx, 'fbx_look_around');
    processFbx(pointingFbx, 'fbx_pointing');
    
    return clips;
  }, [gltfAnimations, idleRumbaFbx, idleStandingFbx, talkFbx, jumpFbx, angryFbx, greetingFbx, hipHopFbx, kissFbx, lookAroundFbx, pointingFbx]);

  const { actions } = useAnimations(allAnimations, group);
  const [currentAction, setCurrentAction] = useState<string | null>(null);

  const bones = useMemo(() => {
    const b: { head?: THREE.Bone; leftBreast?: THREE.Bone; rightBreast?: THREE.Bone } = {};
    scene.traverse((child) => {
      if ((child as THREE.Bone).isBone) {
        const lowerName = child.name.toLowerCase();
        if (lowerName.includes('head')) b.head = child as THREE.Bone;
        if (lowerName.includes('leftbreast')) b.leftBreast = child as THREE.Bone;
        if (lowerName.includes('rightbreast')) b.rightBreast = child as THREE.Bone;
      }
    });
    return b;
  }, [scene]);

  useEffect(() => {
    if (!actions) return;
    const names = Object.keys(actions);
    
    // Helper to find animation by name pattern
    const findAnim = (pattern: string) => names.find(n => n.includes(pattern));

    const talkName = findAnim('fbx_talk');
    const idleStandingName = findAnim('fbx_idle_standing');
    const idleRumbaName = findAnim('fbx_idle_rumba');
    const jumpName = findAnim('fbx_jump');
    const angryName = findAnim('fbx_angry');
    const greetingName = findAnim('fbx_greeting');
    const hipHopName = findAnim('fbx_hip_hop');
    const kissName = findAnim('fbx_kiss');
    const lookAroundName = findAnim('fbx_look_around');
    const pointingName = findAnim('fbx_pointing');
    
    let nextAction = names[0];
    
    // Priority logic for animations
    if (isJumpCommanded) nextAction = jumpName || names[0];
    else if (isAngryCommanded) nextAction = angryName || names[0];
    else if (isGreetingCommanded) nextAction = greetingName || names[0];
    else if (isHipHopCommanded) nextAction = hipHopName || names[0];
    else if (isKissCommanded) nextAction = kissName || names[0];
    else if (isLookAroundCommanded) nextAction = lookAroundName || names[0];
    else if (isPointingCommanded) nextAction = pointingName || names[0];
    else if (isRumbaCommanded) nextAction = idleRumbaName || names[0];
    else if (isSpeaking) nextAction = talkName || names[0];
    else if (isRandomDancing) nextAction = idleRumbaName || idleStandingName || names[0];
    else nextAction = idleStandingName || names[0];

    if (nextAction && nextAction !== currentAction) {
      const prev = currentAction ? actions[currentAction] : null;
      const next = actions[nextAction];
      if (next) {
        if (prev) prev.fadeOut(0.3);
        next.reset().fadeIn(0.3).play();
        setCurrentAction(nextAction);
      }
    }
  }, [
    isSpeaking, isRandomDancing, isRumbaCommanded, isJumpCommanded, 
    isAngryCommanded, isGreetingCommanded, isHipHopCommanded, 
    isKissCommanded, isLookAroundCommanded, isPointingCommanded,
    actions, currentAction
  ]);

  useFrame((state) => {
    if (!scene) return;
    const t = state.clock.getElapsedTime();
    scene.traverse((child) => {
      if ((child as THREE.SkinnedMesh).isSkinnedMesh) {
        const mesh = child as THREE.SkinnedMesh;
        if (mesh.morphTargetDictionary && mesh.morphTargetInfluences) {
          const mouthOpenIdx = mesh.morphTargetDictionary['mouthOpen'] ?? mesh.morphTargetDictionary['jawOpen'];
          if (mouthOpenIdx !== undefined) {
            const target = isSpeaking ? audioAmplitude * 0.8 : 0;
            const current = mesh.morphTargetInfluences[mouthOpenIdx];
            const desired = Math.min(target, 0.45);
            mesh.morphTargetInfluences[mouthOpenIdx] = current + (desired - current) * 0.2;
          }
          const blink = Math.sin(t * 3.8) > 0.98 ? 1 : 0;
          ['eyeBlinkLeft', 'eyeBlinkRight'].forEach(name => {
            const idx = mesh.morphTargetDictionary![name];
            if (idx !== undefined) {
              const curBlink = mesh.morphTargetInfluences![idx];
              mesh.morphTargetInfluences![idx] = curBlink + (blink - curBlink) * 0.4;
            }
          });
        }
      }
    });

    if (bones.leftBreast) bones.leftBreast.scale.set(1.4, 1.4, 1.4);
    if (bones.rightBreast) bones.rightBreast.scale.set(1.4, 1.4, 1.4);
    if (group.current) group.current.position.y = Math.sin(t * 1.2) * 0.01 - 1.6;
  });

  return (
    <group ref={group} dispose={null}>
      <primitive object={scene} />
    </group>
  );
};

// Preload all assets
useGLTF.preload(AVATAR.url);
[
  ANIMATION_URLS.talking, ANIMATION_URLS.rumba, ANIMATION_URLS.idle, 
  ANIMATION_URLS.jump, ANIMATION_URLS.angry, ANIMATION_URLS.greeting,
  ANIMATION_URLS.hipHop, ANIMATION_URLS.kiss, ANIMATION_URLS.lookAround,
  ANIMATION_URLS.pointing
].forEach(url => useFBX.preload(url));

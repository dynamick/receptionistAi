
import React, { Suspense, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Environment, ContactShadows, Float } from '@react-three/drei';
import { Avatar } from './Avatar';
import Loader from './Loader';
import * as THREE from 'three';

interface SceneProps {
  isSpeaking: boolean;
  isRumbaCommanded: boolean;
  audioAmplitude: number;
}

const CameraController: React.FC<{ isSpeaking: boolean }> = ({ isSpeaking }) => {
  const controlsRef = useRef<any>(null);
  const normalPos = new THREE.Vector3(0, 0, 1.5);
  const normalTarget = new THREE.Vector3(0, -0.3, 0);
  const zoomPos = new THREE.Vector3(0, -0.1, 1.1);
  const zoomTarget = new THREE.Vector3(0, -0.15, 0);

  useFrame((state) => {
    const step = 0.05;
    const targetPos = isSpeaking ? zoomPos : normalPos;
    const targetLookAt = isSpeaking ? zoomTarget : normalTarget;
    state.camera.position.lerp(targetPos, step);
    if (controlsRef.current) {
      controlsRef.current.target.lerp(targetLookAt, step);
      controlsRef.current.update();
    }
  });

  return (
    <OrbitControls 
      ref={controlsRef}
      enablePan={false}
      minDistance={0.5}
      maxDistance={4}
      minPolarAngle={Math.PI / 4}
      maxPolarAngle={Math.PI / 1.7}
      enableDamping
      dampingFactor={0.05}
    />
  );
};

const Scene: React.FC<SceneProps> = ({ isSpeaking, isRumbaCommanded, audioAmplitude }) => {
  return (
    <div className="relative w-full h-full">
      <Loader />
      <Canvas camera={{ position: [0, 0, 1.5], fov: 45 }} className="w-full h-full" shadows>
        <color attach="background" args={['#0f172a']} />
        <Suspense fallback={null}>
          <Environment preset="city" />
          <ambientLight intensity={0.5} />
          <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} intensity={1.2} castShadow />
          <Float speed={1.2} rotationIntensity={0.1} floatIntensity={0.2}>
            <Avatar 
              modelUrl="avatar.glb" 
              isSpeaking={isSpeaking}
              isRumbaCommanded={isRumbaCommanded}
              audioAmplitude={audioAmplitude}
            />
          </Float>
          <ContactShadows opacity={0.4} scale={10} blur={2.5} far={4} resolution={256} color="#000000" />
        </Suspense>
        <CameraController isSpeaking={isSpeaking} />
      </Canvas>
    </div>
  );
};

export default Scene;

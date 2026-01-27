
import React, { Suspense, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Environment, ContactShadows, Float } from '@react-three/drei';
import { Avatar } from './Avatar';
import * as THREE from 'three';

interface SceneProps {
  isSpeaking: boolean;
  audioAmplitude: number;
}

/**
 * CameraController gestisce sia lo zoom della telecamera che il target degli OrbitControls.
 * I valori di Y sono stati abbassati per allinearsi alla posizione reale della testa 
 * dell'avatar (considerando l'offset di -1.6 nel componente Avatar).
 */
const CameraController: React.FC<{ isSpeaking: boolean }> = ({ isSpeaking }) => {
  const controlsRef = useRef<any>(null);
  
  // L'avatar è posizionato a Y = -1.6. 
  // La testa di un modello RPM è a circa 1.65m-1.70m dall'origine del modello.
  // Quindi la testa nel mondo 3D si trova intorno a Y = 0.05 / 0.1.

  // Inquadratura Normal: Mezzo busto, telecamera leggermente più alta del petto
  const normalPos = new THREE.Vector3(0, 0, 1.5);
  const normalTarget = new THREE.Vector3(0, -0.3, 0);
  
  // Inquadratura Zoom: Primissimo piano centrato sugli occhi/bocca (Y ≈ 0.05)
  const zoomPos = new THREE.Vector3(0, 0.05, 0.55);
  const zoomTarget = new THREE.Vector3(0, 0.05, 0);

  useFrame((state) => {
    const step = 0.06; // Velocità di transizione fluida
    
    const targetPos = isSpeaking ? zoomPos : normalPos;
    const targetLookAt = isSpeaking ? zoomTarget : normalTarget;

    // 1. Muoviamo la telecamera
    state.camera.position.lerp(targetPos, step);
    
    // 2. Aggiorniamo il target degli OrbitControls
    if (controlsRef.current) {
      controlsRef.current.target.lerp(targetLookAt, step);
      controlsRef.current.update();
    }
  });

  return (
    <OrbitControls 
      ref={controlsRef}
      enablePan={false}
      minDistance={0.3}
      maxDistance={3}
      minPolarAngle={Math.PI / 4}
      maxPolarAngle={Math.PI / 1.7}
      enableDamping
      dampingFactor={0.05}
    />
  );
};

const Scene: React.FC<SceneProps> = ({ isSpeaking, audioAmplitude }) => {
  return (
    <Canvas
      camera={{ position: [0, 0, 1.5], fov: 45 }}
      className="w-full h-full"
      shadows
    >
      <color attach="background" args={['#0f172a']} />
      
      <Suspense fallback={null}>
        <Environment preset="city" />
        <ambientLight intensity={0.5} />
        <spotLight 
          position={[10, 10, 10]} 
          angle={0.15} 
          penumbra={1} 
          intensity={1.2} 
          castShadow 
        />
        
        <Float speed={1.2} rotationIntensity={0.1} floatIntensity={0.2}>
          <Avatar 
            modelUrl="avatar.glb" 
            isSpeaking={isSpeaking}
            audioAmplitude={audioAmplitude}
          />
        </Float>

        <ContactShadows 
          opacity={0.4} 
          scale={10} 
          blur={2.5} 
          far={4} 
          resolution={256} 
          color="#000000" 
        />
      </Suspense>

      <CameraController isSpeaking={isSpeaking} />
    </Canvas>
  );
};

export default Scene;

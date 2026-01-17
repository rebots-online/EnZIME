import { useState, useRef, useEffect } from 'react';
import { X, Mic, MicOff, Pencil, StickyNote, Trash2, Save } from 'lucide-react';
import { useStore, Annotation } from '../store';

interface AnnotationPanelProps {
  onClose: () => void;
}

export default function AnnotationPanel({ onClose }: AnnotationPanelProps) {
  const { annotations, addAnnotation, removeAnnotation } = useStore();
  const [activeTab, setActiveTab] = useState<'voice' | 'ink' | 'text'>('text');
  const [isRecording, setIsRecording] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [noteColor, setNoteColor] = useState('yellow');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Canvas drawing handlers
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.strokeStyle = '#f97316';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, []);

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    ctx.beginPath();
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const saveInkAnnotation = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dataUrl = canvas.toDataURL('image/png');
    const annotation: Annotation = {
      id: Date.now().toString(),
      type: 'ink',
      content: dataUrl,
      x: 0,
      y: 0,
      color: '#f97316',
      createdAt: new Date().toISOString(),
    };
    addAnnotation(annotation);
    clearCanvas();
  };

  // Voice recording handlers
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = reader.result as string;
          const annotation: Annotation = {
            id: Date.now().toString(),
            type: 'voice',
            content: base64,
            x: 0,
            y: 0,
            color: '#3b82f6',
            createdAt: new Date().toISOString(),
          };
          addAnnotation(annotation);
        };
        reader.readAsDataURL(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error('Failed to start recording:', error);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  // Text note handler
  const saveTextNote = () => {
    if (!noteText.trim()) return;

    const annotation: Annotation = {
      id: Date.now().toString(),
      type: 'text',
      content: noteText,
      x: 0,
      y: 0,
      color: noteColor,
      createdAt: new Date().toISOString(),
    };
    addAnnotation(annotation);
    setNoteText('');
  };

  const colors = [
    { name: 'yellow', class: 'bg-yellow-400' },
    { name: 'blue', class: 'bg-blue-400' },
    { name: 'green', class: 'bg-green-400' },
    { name: 'pink', class: 'bg-pink-400' },
  ];

  return (
    <aside className="w-80 bg-gray-800 border-l border-gray-700 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
        <h2 className="font-semibold text-white">Annotations</h2>
        <button onClick={onClose} className="text-gray-400 hover:text-white">
          <X size={20} />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-700">
        <button
          onClick={() => setActiveTab('text')}
          className={`flex-1 flex items-center justify-center gap-2 py-3 ${
            activeTab === 'text' ? 'bg-gray-700 text-orange-400' : 'text-gray-400'
          }`}
        >
          <StickyNote size={18} />
          Note
        </button>
        <button
          onClick={() => setActiveTab('voice')}
          className={`flex-1 flex items-center justify-center gap-2 py-3 ${
            activeTab === 'voice' ? 'bg-gray-700 text-orange-400' : 'text-gray-400'
          }`}
        >
          <Mic size={18} />
          Voice
        </button>
        <button
          onClick={() => setActiveTab('ink')}
          className={`flex-1 flex items-center justify-center gap-2 py-3 ${
            activeTab === 'ink' ? 'bg-gray-700 text-orange-400' : 'text-gray-400'
          }`}
        >
          <Pencil size={18} />
          Ink
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {activeTab === 'text' && (
          <div className="space-y-4">
            <textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="Type your note..."
              className="w-full h-32 bg-gray-900 text-white p-3 rounded-lg border border-gray-700 focus:border-orange-500 focus:outline-none resize-none"
            />
            <div className="flex gap-2">
              {colors.map((c) => (
                <button
                  key={c.name}
                  onClick={() => setNoteColor(c.name)}
                  className={`w-8 h-8 rounded-full ${c.class} ${
                    noteColor === c.name ? 'ring-2 ring-white ring-offset-2 ring-offset-gray-800' : ''
                  }`}
                />
              ))}
            </div>
            <button
              onClick={saveTextNote}
              disabled={!noteText.trim()}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg transition-colors"
            >
              <Save size={18} />
              Save Note
            </button>
          </div>
        )}

        {activeTab === 'voice' && (
          <div className="flex flex-col items-center justify-center py-8 space-y-4">
            <button
              onClick={isRecording ? stopRecording : startRecording}
              className={`w-24 h-24 rounded-full flex items-center justify-center transition-colors ${
                isRecording
                  ? 'bg-red-600 hover:bg-red-700 animate-pulse'
                  : 'bg-orange-600 hover:bg-orange-700'
              }`}
            >
              {isRecording ? <MicOff size={32} /> : <Mic size={32} />}
            </button>
            <p className="text-gray-400">
              {isRecording ? 'Recording... Click to stop' : 'Click to start recording'}
            </p>
          </div>
        )}

        {activeTab === 'ink' && (
          <div className="space-y-4">
            <canvas
              ref={canvasRef}
              width={280}
              height={200}
              className="w-full bg-gray-900 rounded-lg border border-gray-700 ink-canvas"
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
            />
            <div className="flex gap-2">
              <button
                onClick={clearCanvas}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
              >
                <Trash2 size={18} />
                Clear
              </button>
              <button
                onClick={saveInkAnnotation}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 rounded-lg transition-colors"
              >
                <Save size={18} />
                Save
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Annotations List */}
      <div className="border-t border-gray-700 p-4 max-h-64 overflow-auto">
        <h3 className="text-sm font-medium text-gray-400 mb-2">
          Saved Annotations ({annotations.length})
        </h3>
        <div className="space-y-2">
          {annotations.map((ann) => (
            <div
              key={ann.id}
              className={`p-3 rounded-lg flex items-start justify-between ${
                ann.type === 'text' ? `post-it ${ann.color}` : 'bg-gray-700'
              }`}
            >
              <div className="flex-1 min-w-0">
                {ann.type === 'text' && (
                  <p className="text-gray-900 text-sm truncate">{ann.content}</p>
                )}
                {ann.type === 'voice' && (
                  <audio controls className="w-full h-8">
                    <source src={ann.content} type="audio/webm" />
                  </audio>
                )}
                {ann.type === 'ink' && (
                  <img src={ann.content} alt="Ink annotation" className="w-full rounded" />
                )}
                <p className="text-xs opacity-60 mt-1">
                  {new Date(ann.createdAt).toLocaleString()}
                </p>
              </div>
              <button
                onClick={() => removeAnnotation(ann.id)}
                className="ml-2 text-gray-500 hover:text-red-400"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}

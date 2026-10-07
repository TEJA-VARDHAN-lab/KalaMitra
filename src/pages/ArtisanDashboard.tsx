import React, { useState, useRef } from 'react';
import { Plus, Package, ShoppingBag, Award, CheckCircle2, Upload, X, AlertCircle } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { VoiceInput } from '../components/VoiceInput';
import { ProductCard } from '../components/ProductCard';
import { OrderCard } from '../components/OrderCard';
import { generateAIStory } from '../utils/aiIntegration'; // Using real OpenAI integration
import { Product } from '../types';
import { backendService } from '../services/backendService';

export const ArtisanDashboard: React.FC = () => {
  const { state, dispatch } = useApp();
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [currentProduct, setCurrentProduct] = useState<Partial<Product>>({});
  const [aiStory, setAiStory] = useState('');
  const [suggestedPrice, setSuggestedPrice] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeTab, setActiveTab] = useState<'products' | 'orders'>('products');
  const [photoUrlInput, setPhotoUrlInput] = useState('');
  const [photoError, setPhotoError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const artisanProducts = state.products.filter(p => p.artisanId === state.user?.id);
  const artisanOrders = state.orders.filter(o => o.artisanId === state.user?.id);

  const isValidUrl = (urlStr: string) => {
    if (urlStr.startsWith('data:image/')) return true;
    try {
      const parsed = new URL(urlStr);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      return false;
    }
  };

  const handleAddPhotoUrl = () => {
    const trimmed = photoUrlInput.trim();
    if (!trimmed) {
      setPhotoError('Please enter an image URL or choose a file.');
      return;
    }

    if (!isValidUrl(trimmed)) {
      setPhotoError('Please enter a valid URL (e.g. https://images.unsplash.com/...)');
      return;
    }

    setCurrentProduct(prev => ({
      ...prev,
      photos: [...(prev.photos || []), trimmed],
    }));
    setPhotoUrlInput('');
    setPhotoError(null);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    const validFiles: File[] = [];
    let hasInvalid = false;

    Array.from(files).forEach(file => {
      if (allowedTypes.includes(file.type) || /\.(jpe?g|png|webp)$/i.test(file.name)) {
        validFiles.push(file);
      } else {
        hasInvalid = true;
      }
    });

    if (hasInvalid) {
      setPhotoError('Unsupported format. Please select JPG, JPEG, PNG, or WEBP images.');
    } else {
      setPhotoError(null);
    }

    if (validFiles.length === 0) {
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    validFiles.forEach(file => {
      const reader = new FileReader();
      reader.onload = (loadEvent) => {
        const result = loadEvent.target?.result as string;
        if (result) {
          setCurrentProduct(prev => ({
            ...prev,
            photos: [...(prev.photos || []), result],
          }));
        }
      };
      reader.onerror = () => {
        setPhotoError(`Failed to load file: ${file.name}`);
      };
      reader.readAsDataURL(file);
    });

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemovePhoto = (indexToRemove: number) => {
    setCurrentProduct(prev => ({
      ...prev,
      photos: prev.photos?.filter((_, idx) => idx !== indexToRemove) || [],
    }));
    setPhotoError(null);
  };

  const resetFormState = () => {
    setShowAddProduct(false);
    setCurrentProduct({});
    setAiStory('');
    setPhotoUrlInput('');
    setPhotoError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleVoiceTranscript = async (text: string) => {
    if (text.trim().length > 10) {
      setIsGenerating(true);
      try {
        const result = await generateAIStory(text, state.user?.region || 'India', state.currentLanguage);
        setAiStory(result.story);
        setSuggestedPrice(result.suggestedPrice);
        setCurrentProduct(prev => ({
          ...prev,
          name: text.split(' ').slice(0, 5).join(' '),
          description: text,
          story: result.story,
          category: result.category,
          materials: result.materials,
          suggestedPrice: result.suggestedPrice,
          price: result.suggestedPrice,
        }));
      } catch (error) {
        console.error('AI generation failed:', error);
      }
      setIsGenerating(false);
    }
  };

  const handleSaveProduct = async () => {
    if (!currentProduct.name || !currentProduct.story) return;

    const product: Product = {
      id: `prod-${Date.now()}`,
      artisanId: state.user!.id,
      artisanName: state.user!.name,
      name: currentProduct.name,
      description: currentProduct.description || '',
      story: currentProduct.story,
      category: currentProduct.category || 'general',
      region: state.user?.region || 'India',
      photos: currentProduct.photos || [],
      price: currentProduct.price || suggestedPrice,
      suggestedPrice: suggestedPrice,
      materials: currentProduct.materials || [],
      hasQualityBadge: false,
      createdAt: new Date().toISOString(),
      isActive: false, // Product goes to QC review first
    };

    // Save to backend
    await backendService.addProduct(product);
    dispatch({ type: 'ADD_PRODUCT', payload: product });
    
    resetFormState();
    
    alert('✅ Product Submitted for QC Review!\n\nYour product has been submitted to our quality control team.\n\n⏳ It will be reviewed by a coordinator before going live on the marketplace.\n\n📋 You will receive a notification once the review is complete.');
  };

  const handleUpdateOrderStatus = async (orderId: string, newStatus: any) => {
    const milestone = {
      status: newStatus,
      timestamp: new Date().toISOString(),
      note: `Status updated to ${newStatus}`,
    };

    dispatch({
      type: 'ADD_MILESTONE',
      payload: {
        orderId,
        milestone: {
          status: newStatus,
          timestamp: new Date().toISOString(),
          note: `Status updated to ${newStatus}`,
        },
      },
    });
    dispatch({
      type: 'UPDATE_ORDER',
      payload: {
        id: orderId,
        updates: { status: newStatus },
      },
    });
  };

  if (showAddProduct) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-2xl font-bold text-deepblue-800 mb-6">
            🎨 Add New Product (Voice-Guided)
          </h2>

          <div className="space-y-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Step 1: Describe your product (Voice or Text)
              </label>
              <VoiceInput
                onTranscript={handleVoiceTranscript}
                placeholder="Tell us about your product: What is it? What makes it special? How did you make it?"
                language={state.currentLanguage}
              />
            </div>

            {isGenerating && (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-terracotta-500 mx-auto"></div>
                <p className="mt-4 text-gray-600">AI is crafting your story...</p>
              </div>
            )}

            {aiStory && (
              <>
                <div className="bg-gradient-to-r from-saffron-50 to-gold-50 p-6 rounded-lg border-2 border-gold-300">
                  <h3 className="font-bold text-deepblue-800 mb-2 flex items-center gap-2">
                    ✨ AI-Generated Story
                  </h3>
                  <p className="text-gray-700 leading-relaxed">{aiStory}</p>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Product Name
                    </label>
                    <input
                      type="text"
                      value={currentProduct.name || ''}
                      onChange={(e) => setCurrentProduct({ ...currentProduct, name: e.target.value })}
                      className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-terracotta-400 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Price (AI Suggested: ₹{suggestedPrice})
                    </label>
                    <input
                      type="number"
                      value={currentProduct.price || suggestedPrice}
                      onChange={(e) => setCurrentProduct({ ...currentProduct, price: Number(e.target.value) })}
                      className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-terracotta-400 outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Product Photos (Add multiple images)
                  </label>
                  
                  <div className="flex flex-col sm:flex-row gap-2 mb-2">
                    <input
                      type="text"
                      placeholder="Enter image URL (or paste from Unsplash)"
                      id="photoInput"
                      value={photoUrlInput}
                      onChange={(e) => {
                        setPhotoUrlInput(e.target.value);
                        if (photoError) setPhotoError(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddPhotoUrl();
                        }
                      }}
                      className={`flex-1 px-4 py-2 border-2 rounded-lg outline-none transition-colors ${
                        photoError ? 'border-red-400 focus:border-red-500' : 'border-gray-300 focus:border-terracotta-400'
                      }`}
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={handleAddPhotoUrl}
                        className="flex-1 sm:flex-none px-5 py-2 bg-terracotta-500 text-white rounded-lg hover:bg-terracotta-600 font-semibold whitespace-nowrap transition-colors flex items-center justify-center gap-1.5 shadow-sm"
                      >
                        <Plus size={18} />
                        Add Photo
                      </button>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="flex-1 sm:flex-none px-4 py-2 bg-saffron-100 text-saffron-800 border border-saffron-300 hover:bg-saffron-200 rounded-lg font-semibold whitespace-nowrap transition-colors flex items-center justify-center gap-1.5 shadow-sm"
                        title="Upload JPG, JPEG, PNG, or WEBP image"
                      >
                        <Upload size={18} />
                        Choose Image
                      </button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/jpg"
                        multiple
                        className="hidden"
                        onChange={handleFileUpload}
                      />
                    </div>
                  </div>

                  {photoError && (
                    <div className="flex items-center gap-1.5 text-sm text-red-600 mb-2">
                      <AlertCircle size={16} className="flex-shrink-0" />
                      <span>{photoError}</span>
                    </div>
                  )}

                  <p className="text-xs text-gray-500 mb-3">
                    Press Enter or click "Add Photo" to add each image. You can add unlimited photos.
                  </p>

                  {currentProduct.photos && currentProduct.photos.length > 0 && (
                    <div className="space-y-2 mb-4">
                      <p className="text-sm font-semibold text-green-600 flex items-center gap-1">
                        <span>✓ {currentProduct.photos.length} photo(s) added</span>
                        <span className="text-xs text-gray-500 font-normal ml-2">
                          (First photo is primary)
                        </span>
                      </p>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                        {currentProduct.photos.map((photo, idx) => (
                          <div key={idx} className="relative group bg-gray-100 rounded-lg overflow-hidden border-2 border-gray-200 hover:border-terracotta-300 transition-all shadow-sm">
                            <img 
                              src={photo} 
                              alt={`Product ${idx + 1}`} 
                              className="w-full h-32 object-cover"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200" viewBox="0 0 300 200"><rect fill="%23f3f4f6" width="300" height="200"/><text fill="%239ca3af" font-family="sans-serif" font-size="14" dy="10.5" font-weight="bold" x="50%" y="50%" text-anchor="middle">Image Failed to Load</text></svg>';
                              }}
                            />
                            <button
                              type="button"
                              onClick={() => handleRemovePhoto(idx)}
                              className="absolute top-1.5 right-1.5 bg-red-600 hover:bg-red-700 text-white w-7 h-7 rounded-full shadow transition-all flex items-center justify-center text-xs font-bold"
                              title="Remove photo"
                              aria-label={`Remove photo ${idx + 1}`}
                            >
                              <X size={14} />
                            </button>
                            {idx === 0 && (
                              <span className="absolute bottom-1.5 left-1.5 bg-green-600 text-white text-xs px-2 py-0.5 rounded shadow font-semibold">
                                Primary
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={resetFormState}
                    className="flex-1 px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveProduct}
                    className="flex-1 px-6 py-3 bg-terracotta-500 text-white rounded-lg hover:bg-terracotta-600 transition-colors font-semibold flex items-center justify-center gap-2"
                  >
                    <CheckCircle2 size={20} />
                    Submit for QC Review
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-terracotta-500 to-saffron-500 text-white rounded-lg p-6 shadow-lg">
        <h1 className="text-3xl font-bold mb-2">Welcome, {state.user?.name}!</h1>
        <p className="text-terracotta-50">Manage your products and orders</p>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg p-6 shadow-md">
          <div className="flex items-center gap-3 mb-2">
            <Package className="text-terracotta-500" size={32} />
            <div>
              <div className="text-3xl font-bold text-deepblue-800">{artisanProducts.length}</div>
              <div className="text-sm text-gray-600">Products</div>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg p-6 shadow-md">
          <div className="flex items-center gap-3 mb-2">
            <ShoppingBag className="text-saffron-600" size={32} />
            <div>
              <div className="text-3xl font-bold text-deepblue-800">{artisanOrders.length}</div>
              <div className="text-sm text-gray-600">Orders</div>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg p-6 shadow-md">
          <div className="flex items-center gap-3 mb-2">
            <Award className="text-green-600" size={32} />
            <div>
              <div className="text-3xl font-bold text-deepblue-800">
                {artisanProducts.filter(p => p.hasQualityBadge).length}
              </div>
              <div className="text-sm text-gray-600">QC Verified</div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex gap-4 border-b-2 border-gray-200">
        <button
          onClick={() => setActiveTab('products')}
          className={`px-6 py-3 font-semibold transition-colors ${
            activeTab === 'products'
              ? 'text-terracotta-600 border-b-2 border-terracotta-600'
              : 'text-gray-600 hover:text-gray-800'
          }`}
        >
          My Products
        </button>
        <button
          onClick={() => setActiveTab('orders')}
          className={`px-6 py-3 font-semibold transition-colors ${
            activeTab === 'orders'
              ? 'text-terracotta-600 border-b-2 border-terracotta-600'
              : 'text-gray-600 hover:text-gray-800'
          }`}
        >
          My Orders
        </button>
      </div>

      {activeTab === 'products' && (
        <>
          <button
            onClick={() => setShowAddProduct(true)}
            className="w-full md:w-auto px-6 py-3 bg-terracotta-500 text-white rounded-lg hover:bg-terracotta-600 transition-colors font-semibold flex items-center justify-center gap-2 shadow-lg"
          >
            <Plus size={20} />
            Add New Product (Voice)
          </button>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {artisanProducts.map(product => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </>
      )}

      {activeTab === 'orders' && (
        <div className="grid md:grid-cols-2 gap-4">
          {artisanOrders.map(order => (
            <OrderCard key={order.id} order={order} userRole="artisan" />
          ))}
        </div>
      )}
    </div>
  );
};

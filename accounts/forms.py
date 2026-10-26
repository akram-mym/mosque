from django import forms
from django.contrib.auth import get_user_model
from .models import Receiptbook 

User = get_user_model()

class ReceiptbookGenerationForm(forms.Form):
    """
    Form for generating multiple receiptbooks at once
    """
    
    assigned_user = forms.ModelChoiceField(
        queryset=User.objects.all(), # সব ইউজার দেখানোর জন্য
        widget=forms.Select(attrs={'class': 'form-control form-control-lg'}),
        label="Assigned User",
        empty_label="Select assigned user"
    )
    
    prefix = forms.CharField(
        max_length=20,
        required=False,
        initial='RCP-',
        widget=forms.TextInput(attrs={
            'class': 'form-control form-control-lg',
            'placeholder': 'e.g., RCPT-'
        }),
        label="Prefix",
        help_text="Optional prefix for receipt numbers"
    )
    
    start_number = forms.IntegerField(
        min_value=1,
        initial=1,
        widget=forms.NumberInput(attrs={
            'class': 'form-control form-control-lg',
            'placeholder': 'Starting number'
        }),
        label="Start Number"
    )
    
    end_number = forms.IntegerField(
        min_value=1,
        initial=100,
        widget=forms.NumberInput(attrs={
            'class': 'form-control form-control-lg',
            'placeholder': 'Ending number'
        }),
        label="End Number"
    )
    
    status = forms.ChoiceField(
        # আপনার Receiptbook মডেলে থাকা STATUS_CHOICES এখানে বসান
        choices=[('unused', 'Unused'), ('used', 'Used'), ('rejected', 'Rejected')], 
        initial='unused',
        widget=forms.Select(attrs={'class': 'form-control form-control-lg'}),
        label="Status"
    )
    
    description = forms.CharField(
        required=False,
        widget=forms.Textarea(attrs={
            'class': 'form-control form-control-lg',
            'rows': 3,
            'placeholder': 'Enter description (optional)'
        }),
        label="Description"
    )

    def clean(self):
        cleaned_data = super().clean()
        start = cleaned_data.get('start_number')
        end = cleaned_data.get('end_number')
        
        # ভ্যালিডেশন: End Number অবশ্যই Start Number এর চেয়ে বড় বা সমান হতে হবে
        if start and end and end < start:
            raise forms.ValidationError("End number must be greater than or equal to start number.")
        
        return cleaned_data

    def get_receipt_count(self):
        """Calculate number of receipts to generate"""
        start = self.cleaned_data.get('start_number', 0)
        end = self.cleaned_data.get('end_number', 0)
        return end - start + 1 if end >= start else 0